import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Either rider or driver cancels a ride. Frees the driver and records audit fields. */
export const cancelRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      rideId: z.string().uuid(),
      reason: z.string().trim().min(1).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ride, error: getErr } = await supabase
      .from("rides")
      .select("id, rider_id, driver_id, status")
      .eq("id", data.rideId)
      .single();
    if (getErr || !ride) throw new Error("Ride not found");
    if (ride.rider_id !== userId && ride.driver_id !== userId) {
      throw new Error("Not a participant of this ride");
    }
    const cancellable = ["requested", "accepted", "arriving"];
    if (!cancellable.includes(ride.status as string)) {
      throw new Error(`Cannot cancel a ride that is ${ride.status}`);
    }

    const now = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("rides")
      .update({
        status: "cancelled",
        cancelled_at: now,
        cancelled_by: userId,
        cancellation_reason: data.reason,
        current_offer_driver_id: null,
        offer_expires_at: null,
      })
      .eq("id", data.rideId);
    if (updErr) throw new Error(updErr.message);

    // Free the driver if they were assigned
    if (ride.driver_id) {
      await supabase.from("drivers").update({ status: "online" }).eq("user_id", ride.driver_id);
    }
    // Expire any pending offers
    await supabase
      .from("ride_offers")
      .update({ status: "expired", responded_at: now })
      .eq("ride_id", data.rideId)
      .eq("status", "pending");

    return { ok: true };
  });

/** Rate the counterparty of a completed ride. */
export const rateRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      rideId: z.string().uuid(),
      stars: z.number().int().min(1).max(5),
      comment: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ride, error: getErr } = await supabase
      .from("rides")
      .select("id, rider_id, driver_id, status")
      .eq("id", data.rideId)
      .single();
    if (getErr || !ride) throw new Error("Ride not found");
    if (ride.status !== "completed") throw new Error("Ride is not completed");
    const isRider = ride.rider_id === userId;
    const isDriver = ride.driver_id === userId;
    if (!isRider && !isDriver) throw new Error("Not a participant");
    const ratee = isRider ? ride.driver_id : ride.rider_id;
    if (!ratee) throw new Error("No counterparty to rate");

    const { error } = await supabase.from("ratings").insert({
      ride_id: data.rideId,
      rater_id: userId,
      ratee_id: ratee,
      role: isRider ? "rider" : "driver",
      stars: data.stars,
      comment: data.comment ?? null,
    });
    if (error) {
      if (error.code === "23505") throw new Error("You already rated this ride");
      throw new Error(error.message);
    }

    // Refresh aggregate driver rating when a rider rates a driver
    if (isRider && ride.driver_id) {
      const { data: agg } = await supabase
        .from("ratings")
        .select("stars")
        .eq("ratee_id", ride.driver_id);
      const stars = (agg ?? []).map((r) => r.stars as number);
      if (stars.length) {
        const avg = stars.reduce((a, b) => a + b, 0) / stars.length;
        await supabase
          .from("drivers")
          .update({ rating: Math.round(avg * 100) / 100 })
          .eq("user_id", ride.driver_id);
      }
    }

    return { ok: true };
  });

/** Driver earnings summary: today / this week / lifetime + trip counts. */
export const getDriverEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("rides")
      .select("fare, completed_at")
      .eq("driver_id", userId)
      .eq("status", "completed");
    if (error) throw new Error(error.message);

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());

    let today = 0, week = 0, total = 0;
    let todayTrips = 0, weekTrips = 0, totalTrips = 0;
    for (const r of data ?? []) {
      const fare = Number(r.fare ?? 0);
      const t = r.completed_at ? new Date(r.completed_at as string) : null;
      total += fare; totalTrips += 1;
      if (t && t >= startOfWeek) { week += fare; weekTrips += 1; }
      if (t && t >= startOfDay) { today += fare; todayTrips += 1; }
    }
    return {
      today: Math.round(today * 100) / 100,
      week: Math.round(week * 100) / 100,
      total: Math.round(total * 100) / 100,
      todayTrips, weekTrips, totalTrips,
    };
  });
