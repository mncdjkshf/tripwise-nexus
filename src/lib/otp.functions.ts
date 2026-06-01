import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OTP_TTL_MIN = 10;

/** Driver marks arrived — generates a 4-digit code only the rider can read via RLS. */
export const markArrivedAndGenerateOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rideId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ride, error } = await supabase
      .from("rides")
      .select("id, driver_id, status")
      .eq("id", data.rideId)
      .single();
    if (error || !ride) throw new Error("Ride not found");
    if (ride.driver_id !== userId) throw new Error("Not your ride");
    if (!["accepted", "arriving"].includes(ride.status as string))
      throw new Error(`Cannot mark arrived from status ${ride.status}`);

    const code = String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString();
    const now = new Date().toISOString();

    await supabase
      .from("rides")
      .update({ status: "arriving", arrived_at: now })
      .eq("id", data.rideId);

    const { error: upErr } = await supabase
      .from("ride_otp")
      .upsert({ ride_id: data.rideId, code, expires_at: expiresAt, consumed_at: null }, { onConflict: "ride_id" });
    if (upErr) throw new Error(upErr.message);

    return { ok: true };
  });

/** Driver enters the 4-digit code shown to the rider; starts the ride. */
export const verifyRideOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ rideId: z.string().uuid(), code: z.string().regex(/^\d{4}$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ride } = await supabase
      .from("rides")
      .select("id, driver_id, status")
      .eq("id", data.rideId)
      .single();
    if (!ride || ride.driver_id !== userId) throw new Error("Not your ride");
    if (ride.status !== "arriving") throw new Error("Driver must be marked arrived first");

    const { data: otp, error: otpErr } = await supabase
      .from("ride_otp")
      .select("code, expires_at, consumed_at")
      .eq("ride_id", data.rideId)
      .single();
    if (otpErr || !otp) throw new Error("No OTP issued for this ride");
    if (otp.consumed_at) throw new Error("OTP already used");
    if (new Date(otp.expires_at as string).getTime() < Date.now()) throw new Error("OTP expired");
    if (otp.code !== data.code) throw new Error("Invalid code");

    const now = new Date().toISOString();
    await supabase.from("ride_otp").update({ consumed_at: now }).eq("ride_id", data.rideId);
    await supabase
      .from("rides")
      .update({ status: "in_progress", started_at: now })
      .eq("id", data.rideId);

    return { ok: true };
  });
