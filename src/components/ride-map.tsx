import { memo, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { loadGoogleMaps } from "@/lib/maps";
import { computeRoute } from "@/lib/routes.functions";

type LatLng = { lat: number; lng: number };

export type RouteInfo = {
  distanceMeters: number;
  durationSeconds: number;
};

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
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const fetchRoute = useServerFn(computeRoute);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !ref.current) return;
        mapRef.current = new g.maps.Map(ref.current, {
          center: pickup ?? { lat: 20.5937, lng: 78.9629 },
          zoom: 13,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          styles: darkMapStyle,
        });
      })
      .catch((e) => console.error(e));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;

    // Clear markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    const add = (pos: LatLng, color: string, label?: string) => {
      const m = new google.maps.Marker({
        position: pos, map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: color,
          fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2,
        },
        label: label ? { text: label, color: "#fff", fontSize: "10px" } : undefined,
      });
      markersRef.current.push(m);
      bounds.extend(pos);
    };
    if (pickup) add(pickup, "#4ade80");
    if (dropoff) add(dropoff, "#f87171");
    if (driver) add(driver, "#fbbf24", "D");
    drivers?.forEach((d) => add(d, "#60a5fa"));

    // Road-routing via Routes API (server-side, through Lovable gateway)
    let cancelled = false;
    if (pickup && dropoff) {
      polylineRef.current?.setMap(null);
      polylineRef.current = null;

      fetchRoute({ data: { origin: pickup, destination: dropoff } })
        .then((info) => {
          if (cancelled || !mapRef.current) return;
          const path = google.maps.geometry.encoding.decodePath(info.encodedPolyline);
          const line = new google.maps.Polyline({
            path,
            strokeColor: "#86efac",
            strokeOpacity: 0.95,
            strokeWeight: 5,
            map: mapRef.current,
          });
          polylineRef.current = line;
          const b = new google.maps.LatLngBounds();
          path.forEach((p) => b.extend(p));
          markersRef.current.forEach((m) => { const p = m.getPosition(); if (p) b.extend(p); });
          mapRef.current.fitBounds(b, 80);
          onRoute?.({ distanceMeters: info.distanceMeters, durationSeconds: info.durationSeconds });
        })
        .catch((err) => {
          console.error("Route failed:", err);
          if (markersRef.current.length > 1) map.fitBounds(bounds, 80);
        });
    } else {
      polylineRef.current?.setMap(null);
      polylineRef.current = null;

      if (markersRef.current.length === 1) {
        map.setCenter(markersRef.current[0].getPosition()!);
        map.setZoom(14);
      } else if (markersRef.current.length > 1) {
        map.fitBounds(bounds, 80);
      }
    }
    return () => { cancelled = true; };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, driver?.lat, driver?.lng, drivers, onRoute, fetchRoute]);

  return <div ref={ref} className={className ?? "h-full w-full rounded-2xl"} />;
}

export const RideMap = memo(RideMapBase);

const darkMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1f" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a93" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a32" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1a1f" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1116" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];
