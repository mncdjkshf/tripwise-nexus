import { memo, useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/maps";

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
  const directionsRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);

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
        directionsServiceRef.current = new g.maps.DirectionsService();
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

    // Road-routing via Directions API
    if (pickup && dropoff && directionsServiceRef.current) {
      // Clean any previous renderer
      directionsRef.current?.setMap(null);
      const renderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        preserveViewport: false,
        polylineOptions: {
          strokeColor: "#86efac",
          strokeOpacity: 0.9,
          strokeWeight: 5,
        },
      });
      renderer.setMap(map);
      directionsRef.current = renderer;

      directionsServiceRef.current.route(
        {
          origin: pickup,
          destination: dropoff,
          travelMode: google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            renderer.setDirections(result);
            const leg = result.routes[0]?.legs[0];
            if (leg?.distance && leg?.duration && onRoute) {
              onRoute({
                distanceMeters: leg.distance.value,
                durationSeconds: leg.duration.value,
              });
            }
          } else {
            console.error("Route failed:", status);
            // Fallback: fit bounds so user still sees both points
            if (markersRef.current.length > 1) map.fitBounds(bounds, 80);
          }
        },
      );
    } else {
      // No route — cleanup previous render
      directionsRef.current?.setMap(null);
      directionsRef.current = null;

      if (markersRef.current.length === 1) {
        map.setCenter(markersRef.current[0].getPosition()!);
        map.setZoom(14);
      } else if (markersRef.current.length > 1) {
        map.fitBounds(bounds, 80);
      }
    }
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, driver?.lat, driver?.lng, drivers, onRoute]);

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
