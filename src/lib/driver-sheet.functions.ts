import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DriverRowSchema = z.object({
  application_id: z.string().max(64),
  driver_name: z.string().min(1).max(200),
  phone: z.string().min(1).max(20),
  email: z.string().email().max(255),
  dob: z.string().max(20),
  gender: z.string().max(20).default(""),
  emergency_contact: z.string().max(200),
  address: z.string().max(1000),
  city: z.string().max(120).default(""),
  state: z.string().max(120).default(""),
  pin_code: z.string().max(10).default(""),
  vehicle_plate: z.string().max(40),
  vehicle_class: z.string().max(40),
  make: z.string().max(80),
  model: z.string().max(80),
  vehicle_registration_number: z.string().max(80).default(""),
  insurance_number: z.string().max(80).default(""),
  insurance_expiry: z.string().max(20).default(""),
  driving_experience_years: z.string().max(10).default(""),
  license_number: z.string().max(80),
  aadhaar_number: z.string().max(20).default(""),
  pan_number: z.string().max(20).default(""),
  bank_account_number: z.string().max(40).default(""),
  bank_ifsc: z.string().max(20).default(""),
  bank_account_holder: z.string().max(200).default(""),
  upi_id: z.string().max(100).default(""),
  profile_photo_url: z.string().max(500).default(""),
  aadhaar_front_url: z.string().max(500).default(""),
  aadhaar_back_url: z.string().max(500).default(""),
  pan_url: z.string().max(500).default(""),
  dl_url: z.string().max(500).default(""),
  dl_back_url: z.string().max(500).default(""),
  rc_url: z.string().max(500).default(""),
  insurance_url: z.string().max(500).default(""),
  onboarding_step: z.string().max(4).default(""),
  status: z.string().max(40),
});

const DEFAULT_SHEET_ID = "1upNzVjj9XlBJdixC4ppGvFKk1puTOcOZfORosi_5aN0";
const DEFAULT_SHEET_TAB = "Applications";

export const syncDriverToSheet = createServerFn({ method: "POST" })
  .inputValidator((input) => DriverRowSchema.parse(input))
  .handler(async ({ data }) => {
    const sheetId = process.env.DRIVER_APPLICATIONS_SHEET_ID || DEFAULT_SHEET_ID;
    const sheetTab = process.env.DRIVER_APPLICATIONS_SHEET_TAB || DEFAULT_SHEET_TAB;
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connectorKey = process.env.GOOGLE_SHEETS_API_KEY;

    if (!lovableKey || !connectorKey) {
      console.warn("[driver-sheet] Sheets sync skipped — connector not linked");
      return { synced: false, reason: "not_configured" as const };
    }

    const row = [
      data.application_id,
      new Date().toISOString(),
      data.driver_name,
      data.phone,
      data.email,
      data.dob,
      data.gender,
      data.emergency_contact,
      data.address,
      data.city,
      data.state,
      data.pin_code,
      data.vehicle_class,
      data.make,
      data.model,
      data.vehicle_plate,
      data.vehicle_registration_number,
      data.insurance_number,
      data.insurance_expiry,
      data.driving_experience_years,
      data.license_number,
      data.aadhaar_number,
      data.pan_number,
      data.bank_account_holder,
      data.bank_account_number,
      data.bank_ifsc,
      data.upi_id,
      data.profile_photo_url,
      data.aadhaar_front_url,
      data.aadhaar_back_url,
      data.pan_url,
      data.dl_url,
      data.dl_back_url,
      data.rc_url,
      data.insurance_url,
      data.onboarding_step,
      data.status,
    ];

    const url = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}/values/${sheetTab}!A:AK:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectorKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[driver-sheet] append failed", res.status, body);
      return { synced: false, reason: `http_${res.status}` };
    }

    return { synced: true, synced_at: new Date().toISOString() };
  });
