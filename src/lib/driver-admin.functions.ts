import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ApproveSchema = z.object({
  driver_id: z.string().uuid(),
  approved: z.boolean(),
});

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listAllDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: drivers, error } = await supabaseAdmin
      .from("drivers")
      .select(
        "id, user_id, vehicle_make, vehicle_model, vehicle_type, vehicle_plate, is_approved, status, rating, total_rides, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const userIds = (drivers ?? []).map((d) => d.user_id);
    const { data: priv, error: pErr } = await supabaseAdmin
      .from("drivers_private")
      .select("user_id, full_name, email, phone_number, car_number, driving_license, personal_details_json")
      .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    if (pErr) throw new Error(pErr.message);
    const privMap = new Map((priv ?? []).map((p) => [p.user_id, p]));
    const merged = (drivers ?? []).map((d) => ({ ...d, ...(privMap.get(d.user_id) ?? {}) }));
    return { drivers: merged };
  });

export const setDriverApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ApproveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("drivers")
      .update({ is_approved: data.approved })
      .eq("id", data.driver_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
