import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/maps";

type LatLng = { lat: number; lng: number };

export function RideMap({
  pickup,
  dropoff,
  driver,
  drivers,
  className,
}: {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  driver?: LatLng | null;
  drivers?: LatLng[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const lineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !ref.current) return;
        mapRef.current = new g.maps.Map(ref.current, {
          center: pickup ?? { lat: 37.7749, lng: -122.4194 },
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
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    lineRef.current?.setMap(null);

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

    if (pickup && dropoff) {
      lineRef.current = new google.maps.Polyline({
        path: [pickup, dropoff], map,
        strokeColor: "#86efac", strokeOpacity: 0.9, strokeWeight: 4,
      });
    }
    if (markersRef.current.length === 1) {
      map.setCenter(markersRef.current[0].getPosition()!);
      map.setZoom(14);
    } else if (markersRef.current.length > 1) {
      map.fitBounds(bounds, 80);
    }
  }, [pickup, dropoff, driver, drivers]);

  return <div ref={ref} className={className ?? "h-full w-full rounded-2xl"} />;
}

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
