/// <reference types="google.maps" />
/* Google Maps JS API loader (browser-only). Uses the Lovable connector browser key. */
let loadPromise: Promise<typeof google> | null = null;

declare global {
  interface Window {
    google: typeof google;
    __initGmaps?: () => void;
  }
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) return reject(new Error("Google Maps browser key missing"));

    window.__initGmaps = () => resolve(window.google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=places&callback=__initGmaps${channel ? `&channel=${channel}` : ""}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return loadPromise;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const RIDE_TYPES = [
  { id: "economy", label: "TahuGo", desc: "Affordable everyday rides", mult: 1.0, eta: 3 },
  { id: "premium", label: "TahuPrime", desc: "Newer cars, top drivers", mult: 1.6, eta: 5 },
  { id: "bike", label: "TahuMoto", desc: "Beat the traffic", mult: 0.45, eta: 2 },
  { id: "suv", label: "TahuXL", desc: "Up to 6 passengers", mult: 2.1, eta: 6 },
] as const;

export function estimateFare(distanceKm: number, type: string) {
  // INR pricing: base ₹40, ₹14/km
  const base = 40;
  const perKm = 14;
  const t = RIDE_TYPES.find((r) => r.id === type) ?? RIDE_TYPES[0];
  return Math.max(50, Math.round((base + distanceKm * perKm) * t.mult));
}
