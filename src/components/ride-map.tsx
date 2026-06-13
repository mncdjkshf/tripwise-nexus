import { memo, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { loadGoogleMaps } from "@/lib/maps";
import { computeRoute } from "@/lib/routes.functions";

type LatLng = { lat: number; lng: number };

export type RouteInfo = {
  distanceMeters: number;
  durationSeconds: number;
};

type VehicleKind = "car" | "bike";

// Inline SVGs (data URLs) so we can rotate via Marker icon.rotation
const CAR_SVG = (color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>
      <g transform='translate(20 20)'>
        <rect x='-7' y='-12' width='14' height='24' rx='3' fill='${color}' stroke='#0a0a0a' stroke-width='1.5'/>
        <rect x='-5.5' y='-9' width='11' height='6' rx='1.5' fill='#cfeaff' opacity='0.9'/>
        <rect x='-5.5' y='3' width='11' height='5' rx='1.5' fill='#cfeaff' opacity='0.6'/>
        <circle cx='-6' cy='-6' r='1.2' fill='#111'/><circle cx='6' cy='-6' r='1.2' fill='#111'/>
        <circle cx='-6' cy='8' r='1.2' fill='#111'/><circle cx='6' cy='8' r='1.2' fill='#111'/>
      </g>
    </svg>`,
  )}`;

const BIKE_SVG = (color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
      <g transform='translate(16 16)'>
        <circle cx='-6' cy='6' r='4' fill='none' stroke='${color}' stroke-width='2'/>
        <circle cx='6' cy='6' r='4' fill='none' stroke='${color}' stroke-width='2'/>
        <path d='M-6 6 L0 -4 L6 6 M-2 -4 L4 -4' stroke='${color}' stroke-width='2' fill='none' stroke-linecap='round'/>
        <circle cx='0' cy='-6' r='2.5' fill='${color}'/>
      </g>
    </svg>`,
  )}`;

function bearing(a: LatLng, b: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function vehicleIcon(kind: VehicleKind, color: string, rotation = 0): google.maps.Icon {
  const size = kind === "bike" ? 28 : 36;
  return {
    url: kind === "bike" ? BIKE_SVG(color) : CAR_SVG(color),
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
    // @ts-expect-error rotation not in TS types for symbol icons but works for URL icons via CSS? fallback below
    rotation,
  };
}

function RideMapBase({
  pickup,
  dropoff,
  driver,
  drivers,
  onRoute,
  className,
}: {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  driver?: LatLng | null;
  drivers?: LatLng[];
  onRoute?: (info: RouteInfo) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pinMarkersRef = useRef<google.maps.Marker[]>([]);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const lastDriverPosRef = useRef<LatLng | null>(null);
  const driverHeadingRef = useRef<number>(0);
  const nearbyMarkersRef = useRef<{ marker: google.maps.Marker; base: LatLng; kind: VehicleKind; phase: number }[]>([]);
  const ambientRafRef = useRef<number | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const fetchRoute = useServerFn(computeRoute);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !ref.current) return;
        mapRef.current = new g.maps.Map(ref.current, {
          center: pickup ?? { lat: 20.5937, lng: 78.9629 },
          zoom: 14,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          styles: lightMapStyle,
        });
      })
      .catch((e) => console.error(e));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pickup / dropoff pin markers + route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;

    pinMarkersRef.current.forEach((m) => m.setMap(null));
    pinMarkersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    const addPin = (pos: LatLng, color: string) => {
      const m = new google.maps.Marker({
        position: pos, map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: color,
          fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3,
        },
      });
      pinMarkersRef.current.push(m);
      bounds.extend(pos);
    };
    if (pickup) addPin(pickup, "#111111");
    if (dropoff) addPin(dropoff, "#1d4ed8");

    let cancelled = false;
    if (pickup && dropoff) {
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
      fetchRoute({ data: { origin: pickup, destination: dropoff } })
        .then((info) => {
          if (cancelled || !mapRef.current) return;
          const path = google.maps.geometry.encoding.decodePath(info.encodedPolyline);
          polylineRef.current = new google.maps.Polyline({
            path, strokeColor: "#0a0a0a", strokeOpacity: 0.95, strokeWeight: 5, map: mapRef.current,
          });
          const b = new google.maps.LatLngBounds();
          path.forEach((p) => b.extend(p));
          pinMarkersRef.current.forEach((m) => { const p = m.getPosition(); if (p) b.extend(p); });
          mapRef.current.fitBounds(b, 80);
          onRoute?.({ distanceMeters: info.distanceMeters, durationSeconds: info.durationSeconds });
        })
        .catch((err) => {
          console.error("Route failed:", err);
          if (pinMarkersRef.current.length > 1) map.fitBounds(bounds, 80);
        });
    } else {
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
      if (pinMarkersRef.current.length === 1) {
        map.setCenter(pinMarkersRef.current[0].getPosition()!);
        map.setZoom(15);
      } else if (pinMarkersRef.current.length > 1) {
        map.fitBounds(bounds, 80);
      }
    }
    return () => { cancelled = true; };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, onRoute, fetchRoute]);

  // Assigned driver marker — animated car with rotation
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    if (!driver) {
      driverMarkerRef.current?.setMap(null);
      driverMarkerRef.current = null;
      lastDriverPosRef.current = null;
      return;
    }
    if (lastDriverPosRef.current) {
      driverHeadingRef.current = bearing(lastDriverPosRef.current, driver);
    }
    lastDriverPosRef.current = driver;

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        position: driver, map,
        icon: vehicleIcon("car", "#facc15", driverHeadingRef.current),
        zIndex: 999,
      });
    } else {
      driverMarkerRef.current.setPosition(driver);
      driverMarkerRef.current.setIcon(vehicleIcon("car", "#facc15", driverHeadingRef.current));
    }
  }, [driver?.lat, driver?.lng]);

  // Nearby drivers — render as car icons with subtle ambient drift
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;

    nearbyMarkersRef.current.forEach((d) => d.marker.setMap(null));
    nearbyMarkersRef.current = [];

    (drivers ?? []).forEach((d, i) => {
      const kind: VehicleKind = i % 3 === 0 ? "bike" : "car";
      const color = kind === "bike" ? "#1d4ed8" : "#0a0a0a";
      const marker = new google.maps.Marker({
        position: d, map,
        icon: vehicleIcon(kind, color, Math.random() * 360),
      });
      nearbyMarkersRef.current.push({ marker, base: d, kind, phase: Math.random() * Math.PI * 2 });
    });

    if (ambientRafRef.current) cancelAnimationFrame(ambientRafRef.current);
    const tick = () => {
      const t = performance.now() / 1000;
      nearbyMarkersRef.current.forEach((d) => {
        // ~10 metre wobble in a slow circle
        const r = 0.00009;
        const lat = d.base.lat + Math.sin(t * 0.4 + d.phase) * r;
        const lng = d.base.lng + Math.cos(t * 0.4 + d.phase) * r;
        d.marker.setPosition({ lat, lng });
      });
      ambientRafRef.current = requestAnimationFrame(tick);
    };
    if (nearbyMarkersRef.current.length) ambientRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (ambientRafRef.current) cancelAnimationFrame(ambientRafRef.current);
    };
  }, [drivers]);

  return <div ref={ref} className={className ?? "h-full w-full"} />;
}

export const RideMap = memo(RideMapBase);

// Clean light "Uber-like" map style
const lightMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b6b6b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ffe082" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#f6c343" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe8ff" }] },
];
