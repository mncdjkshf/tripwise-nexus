import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OFFER_TTL_SECONDS = 15;
const MAX_DISPATCH_ATTEMPTS = 5;
const MAX_RADIUS_KM = 10;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function offerToNextDriver(supabase: any, rideId: string) {
  // Re-load ride
  const { data: ride, error: rideErr } = await supabase
    .from("rides")
    .select("id, status, pickup_lat, pickup_lng, ride_type, rejected_driver_ids, driver_id")
    .eq("id", rideId)
    .single();
  if (rideErr) throw new Error(rideErr.message);
  if (!ride) throw new Error("Ride not found");
  if (ride.driver_id) return { offered: false, reason: "already_assigned" as const };
  if (ride.status !== "requested") return { offered: false, reason: "not_requested" as const };

  const rejected: string[] = (ride.rejected_driver_ids as string[]) ?? [];
  if (rejected.length >= MAX_DISPATCH_ATTEMPTS) {
    await supabase
      .from("rides")
      .update({ status: "no_drivers_available", current_offer_driver_id: null, offer_expires_at: null })
      .eq("id", rideId);
    return { offered: false, reason: "max_attempts" as const };
  }

  // Find online approved drivers of matching vehicle type with a recent location
  const { data: candidates, error: drvErr } = await supabase
    .from("drivers")
    .select("user_id, vehicle_type, current_lat, current_lng, status, is_approved")
    .eq("is_approved", true)
    .eq("vehicle_type", ride.ride_type)
    .neq("status", "offline")
    .not("current_lat", "is", null)
    .not("current_lng", "is", null);
  if (drvErr) throw new Error(drvErr.message);

  const pickup = { lat: ride.pickup_lat as number, lng: ride.pickup_lng as number };
  const ranked = (candidates ?? [])
    .filter((d) => !rejected.includes(d.user_id as string))
    .map((d) => ({
      driver_id: d.user_id as string,
      km: haversineKm(pickup, { lat: d.current_lat as number, lng: d.current_lng as number }),
    }))
    .filter((d) => d.km <= MAX_RADIUS_KM)
    .sort((a, b) => a.km - b.km);

  const next = ranked[0];
  if (!next) {
    await supabase
      .from("rides")
      .update({ status: "no_drivers_available", current_offer_driver_id: null, offer_expires_at: null })
      .eq("id", rideId);
    return { offered: false, reason: "no_drivers" as const };
  }

  const expiresAt = new Date(Date.now() + OFFER_TTL_SECONDS * 1000).toISOString();

  const { data: offer, error: offErr } = await supabase
    .from("ride_offers")
    .insert({ ride_id: rideId, driver_id: next.driver_id, expires_at: expiresAt, status: "pending" })
    .select("id")
    .single();
  if (offErr) throw new Error(offErr.message);

  await supabase
    .from("rides")
    .update({ current_offer_driver_id: next.driver_id, offer_expires_at: expiresAt })
    .eq("id", rideId);

  return { offered: true, offerId: offer.id as string, driverId: next.driver_id, expiresAt };
}

/** Rider triggers dispatch after creating the ride row. */
export const requestRideWithDispatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rideId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ride } = await supabase
      .from("rides")
      .select("rider_id, status")
      .eq("id", data.rideId)
      .single();
    if (!ride || ride.rider_id !== userId) throw new Error("Not authorized for this ride");
    if (ride.status !== "requested") throw new Error("Ride is not in requested state");
    return offerToNextDriver(supabase as never, data.rideId);
  });

/** Driver accepts/rejects a pending offer. Accept locks the ride atomically. */
export const respondToOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ offerId: z.string().uuid(), accept: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    const { data: offer, error: getErr } = await supabase
      .from("ride_offers")
      .select("id, ride_id, driver_id, status, expires_at")
      .eq("id", data.offerId)
      .single();
    if (getErr || !offer) throw new Error("Offer not found");
    if (offer.driver_id !== userId) throw new Error("Not your offer");
    if (offer.status !== "pending") throw new Error(`Offer already ${offer.status}`);
    if (new Date(offer.expires_at as string).getTime() < Date.now()) {
      await supabase
        .from("ride_offers")
        .update({ status: "expired", responded_at: now })
        .eq("id", offer.id);
      throw new Error("Offer expired");
    }

    if (data.accept) {
      // Atomic-ish accept: only succeeds if ride still unassigned & in requested status
      const { data: updated, error: lockErr } = await supabase
        .from("rides")
        .update({
          driver_id: userId,
          status: "accepted",
          accepted_at: now,
          current_offer_driver_id: null,
          offer_expires_at: null,
        })
        .eq("id", offer.ride_id)
        .is("driver_id", null)
        .eq("status", "requested")
        .select("id")
        .maybeSingle();
      if (lockErr) throw new Error(lockErr.message);
      if (!updated) throw new Error("Ride already taken");

      await supabase
        .from("ride_offers")
        .update({ status: "accepted", responded_at: now })
        .eq("id", offer.id);
      // Expire any other pending offers for this ride
      await supabase
        .from("ride_offers")
        .update({ status: "expired", responded_at: now })
        .eq("ride_id", offer.ride_id)
        .eq("status", "pending");
      // Driver goes on_ride
      await supabase.from("drivers").update({ status: "on_ride" }).eq("user_id", userId);
      return { accepted: true, rideId: offer.ride_id };
    }

    // Reject path
    await supabase
      .from("ride_offers")
      .update({ status: "rejected", responded_at: now })
      .eq("id", offer.id);

    // Append rejecter and try next driver
    const { data: ride } = await supabase
      .from("rides")
      .select("rejected_driver_ids")
      .eq("id", offer.ride_id)
      .single();
    const next = Array.from(new Set([...(((ride?.rejected_driver_ids as string[]) ?? [])), userId]));
    await supabase
      .from("rides")
      .update({ rejected_driver_ids: next, current_offer_driver_id: null, offer_expires_at: null })
      .eq("id", offer.ride_id);
    const result = await offerToNextDriver(supabase as never, offer.ride_id as string);
    return { accepted: false, next: result };
  });

/** Called when the current offer's TTL elapses without a response. */
export const expireAndAdvanceOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rideId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ride } = await supabase
      .from("rides")
      .select("rider_id, status, current_offer_driver_id, offer_expires_at, rejected_driver_ids")
      .eq("id", data.rideId)
      .single();
    if (!ride || ride.rider_id !== userId) throw new Error("Not authorized for this ride");
    if (ride.status !== "requested") return { advanced: false, reason: "not_requested" };
    if (!ride.offer_expires_at || new Date(ride.offer_expires_at as string).getTime() > Date.now()) {
      return { advanced: false, reason: "not_expired" };
    }

    const now = new Date().toISOString();
    // Expire the current pending offer
    if (ride.current_offer_driver_id) {
      await supabase
        .from("ride_offers")
        .update({ status: "expired", responded_at: now })
        .eq("ride_id", data.rideId)
        .eq("driver_id", ride.current_offer_driver_id as string)
        .eq("status", "pending");
      const rejected = Array.from(
        new Set([...(((ride.rejected_driver_ids as string[]) ?? [])), ride.current_offer_driver_id as string]),
      );
      await supabase
        .from("rides")
        .update({ rejected_driver_ids: rejected, current_offer_driver_id: null, offer_expires_at: null })
        .eq("id", data.rideId);
    }
    const result = await offerToNextDriver(supabase as never, data.rideId);
    return { advanced: true, ...result };
  });
