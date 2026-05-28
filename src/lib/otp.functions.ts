import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RequestSchema = z.object({
  identifier: z.string().min(3).max(255),
  channel: z.enum(["email", "phone"]).default("email"),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
});

const VerifySchema = z.object({
  identifier: z.string().min(3).max(255),
  code: z.string().regex(/^\d{6}$/),
});

const MarkValidatedSchema = z.object({
  user_id: z.string().uuid(),
});

async function dispatchToN8n(payload: Record<string, unknown>) {
  const url = process.env.N8N_OTP_WEBHOOK_URL;
  if (!url) {
    console.log("[OTP] N8N_OTP_WEBHOOK_URL not set. Payload:", payload);
    return { dispatched: false, reason: "webhook_unset" };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("[OTP] n8n responded", res.status, await res.text().catch(() => ""));
      return { dispatched: false, reason: `n8n_${res.status}` };
    }
    return { dispatched: true };
  } catch (e) {
    console.error("[OTP] n8n dispatch failed", e);
    return { dispatched: false, reason: "n8n_error" };
  }
}

export const requestOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => RequestSchema.parse(input))
  .handler(async ({ data }) => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin.from("otp_verifications").insert({
      identifier: data.identifier,
      channel: data.channel,
      otp_code: code,
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);

    const dispatch = await dispatchToN8n({
      otp_code: code,
      identifier: data.identifier,
      channel: data.channel,
      email: data.email ?? (data.channel === "email" ? data.identifier : undefined),
      phone_number: data.phone ?? (data.channel === "phone" ? data.identifier : undefined),
      expires_at: expiresAt,
    });

    // In dev (no webhook configured) we surface the code so the user can complete the flow.
    const debugCode = dispatch.dispatched ? undefined : code;
    return { ok: true, debug_code: debugCode };
  });

export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => VerifySchema.parse(input))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("otp_verifications")
      .select("id, otp_code, expires_at, consumed_at")
      .eq("identifier", data.identifier)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row) return { ok: false, reason: "no_code" as const };
    if (row.consumed_at) return { ok: false, reason: "already_used" as const };
    if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" as const };
    if (row.otp_code !== data.code) return { ok: false, reason: "mismatch" as const };

    await supabaseAdmin
      .from("otp_verifications")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    return { ok: true as const };
  });

// Called after the user has authenticated AND verified OTP to flip their profile.
export const markProfileValidated = createServerFn({ method: "POST" })
  .inputValidator((input) => MarkValidatedSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_validated: true })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
