import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).max(500).optional(),
});

/** Driver-only: upsert the driver's live GPS location. Throttle on client to ~3-5s. */
export const pingDriverLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("driver_locations")
      .upsert(
        {
          driver_id: userId,
          lat: data.lat,
          lng: data.lng,
          heading: data.heading ?? null,
          speed: data.speed ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "driver_id" },
      );
    if (error) throw new Error(error.message);
    // Mirror to drivers.current_lat/lng so the existing dispatch query stays consistent
    await supabase
      .from("drivers")
      .update({ current_lat: data.lat, current_lng: data.lng, last_ping: new Date().toISOString() })
      .eq("user_id", userId);
    return { ok: true };
  });
