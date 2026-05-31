import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LatLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const Input = z.object({ origin: LatLng, destination: LatLng });

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

/**
 * Compute a road-routed path via Google Routes API (server-side, through the
 * Lovable connector gateway). The browser key cannot call Routes/Directions —
 * only Maps JS + Places (New) — so this must run server-side.
 *
 * Returns the encoded polyline + distance/duration so the client can draw it
 * on the map and compute fare/ETA.
 */
export const computeRoute = createServerFn({ method: "POST" })
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!GOOGLE_MAPS_API_KEY) throw new Error("GOOGLE_MAPS_API_KEY missing — connect Google Maps Platform");

    const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: data.origin.lat, longitude: data.origin.lng } } },
        destination: { location: { latLng: { latitude: data.destination.lat, longitude: data.destination.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Routes API ${res.status}: ${body}`);
    }
    const json = (await res.json()) as {
      routes?: Array<{
        distanceMeters?: number;
        duration?: string; // e.g. "523s"
        polyline?: { encodedPolyline?: string };
      }>;
    };
    const r = json.routes?.[0];
    if (!r?.polyline?.encodedPolyline) throw new Error("No route returned");

    return {
      encodedPolyline: r.polyline.encodedPolyline,
      distanceMeters: r.distanceMeters ?? 0,
      durationSeconds: r.duration ? Number(r.duration.replace(/s$/, "")) : 0,
    };
  });
