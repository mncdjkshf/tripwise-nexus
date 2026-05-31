import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DriverRowSchema = z.object({
  application_id: z.string().max(64),
  driver_name: z.string().min(1).max(200),
  phone: z.string().min(1).max(20),
  email: z.string().email().max(255),
  dob: z.string().max(20),
  emergency_contact: z.string().max(200),
  address: z.string().max(1000),
  vehicle_plate: z.string().max(40),
  vehicle_class: z.string().max(40),
  make: z.string().max(80),
  model: z.string().max(80),
  license_number: z.string().max(80),
  background_notes: z.string().max(2000),
  status: z.string().max(40),
});

// Appends a row to the configured Google Sheet via the Lovable Google Sheets connector.
// Required env (provided by the google_sheets connector once linked):
//   - LOVABLE_API_KEY
//   - GOOGLE_SHEETS_API_KEY
// Required app-level secret:
//   - DRIVER_APPLICATIONS_SHEET_ID  (the spreadsheet ID)
//   - DRIVER_APPLICATIONS_SHEET_TAB (optional, defaults to "Sheet1")
export const syncDriverToSheet = createServerFn({ method: "POST" })
  .inputValidator((input) => DriverRowSchema.parse(input))
  .handler(async ({ data }) => {
    const sheetId = process.env.DRIVER_APPLICATIONS_SHEET_ID;
    const sheetTab = process.env.DRIVER_APPLICATIONS_SHEET_TAB || "Sheet1";
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connectorKey = process.env.GOOGLE_SHEETS_API_KEY;

    if (!sheetId || !lovableKey || !connectorKey) {
      console.warn("[driver-sheet] Sheets sync skipped — missing credentials/sheet id");
      return { synced: false, reason: "not_configured" as const };
    }

    const row = [
      data.application_id,
      new Date().toISOString(),
      data.driver_name,
      data.phone,
      data.email,
      data.dob,
      data.emergency_contact,
      data.address,
      data.vehicle_plate,
      data.vehicle_class,
      data.make,
      data.model,
      data.license_number,
      data.background_notes,
      data.status,
    ];

    const url = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}/values/${sheetTab}!A:O:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

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

    return { synced: true };
  });
