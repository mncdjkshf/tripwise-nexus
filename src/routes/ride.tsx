import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { RideMap } from "@/components/ride-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { loadGoogleMaps, haversineKm, estimateFare, RIDE_TYPES } from "@/lib/maps";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/ride")({
  head: () => ({ meta: [{ title: "Book a ride — Tahu cab's" }] }),
  component: BookRide,
});

type LatLng = { lat: number; lng: number };

function BookRide() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [pickup, setPickup] = useState<{ address: string; pos: LatLng } | null>(null);
  const [dropoff, setDropoff] = useState<{ address: string; pos: LatLng } | null>(null);
  const [type, setType] = useState<string>("economy");
  const [requesting, setRequesting] = useState(false);
  const [nearby, setNearby] = useState<LatLng[]>([]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  // Use device GPS to default pickup
  useEffect(() => {
    if (pickup || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPickup({ address: "Current location", pos: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      () => {},
      { maximumAge: 30000 },
    );
  }, [pickup]);

  // Live nearby drivers (1km radius) around pickup
  useEffect(() => {
    if (!pickup) return;
    let cancelled = false;
    const refresh = async () => {
      const { data } = await supabase
        .from("drivers")
        .select("current_lat,current_lng,status")
        .neq("status", "offline");
      if (cancelled) return;
      const within = (data ?? [])
        .filter((d) => d.current_lat != null && d.current_lng != null)
        .map((d) => ({ lat: d.current_lat as number, lng: d.current_lng as number }))
        .filter((p) => haversineKm(p, pickup.pos) <= 1);
      setNearby(within);
    };
    refresh();
    const ch = supabase
      .channel("nearby-drivers")
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, refresh)
      .subscribe();
    const t = setInterval(refresh, 10000);
    return () => { cancelled = true; supabase.removeChannel(ch); clearInterval(t); };
  }, [pickup?.pos.lat, pickup?.pos.lng]);

  const distance = useMemo(
    () => (pickup && dropoff ? haversineKm(pickup.pos, dropoff.pos) : 0),
    [pickup, dropoff],
  );

  const onRequest = async () => {
    if (!user || !pickup || !dropoff) return;
    setRequesting(true);
    const fare = estimateFare(distance, type);
    const { data, error } = await supabase
      .from("rides")
      .insert({
        rider_id: user.id,
        pickup_address: pickup.address,
        pickup_lat: pickup.pos.lat,
        pickup_lng: pickup.pos.lng,
        dropoff_address: dropoff.address,
        dropoff_lat: dropoff.pos.lat,
        dropoff_lng: dropoff.pos.lng,
        ride_type: type as "economy" | "premium" | "bike" | "suv",
        fare,
        distance_km: Math.round(distance * 100) / 100,
        duration_min: Math.max(5, Math.round(distance * 3)),
      })
      .select("id")
      .single();
    setRequesting(false);
    if (error) return toast.error(error.message);
    toast.success("Searching for drivers…");
    nav({ to: "/track/$rideId", params: { rideId: data.id } });
  };

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[400px_1fr]">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Where to?</h1>
            {pickup && (
              <span className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">
                {nearby.length} nearby
              </span>
            )}
          </div>
          <PlaceField label="Pickup" dot="bg-accent" value={pickup?.address ?? ""} onPick={setPickup} />
          <PlaceField label="Drop-off" dot="bg-destructive" value={dropoff?.address ?? ""} onPick={setDropoff} />

          {pickup && dropoff && (
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <p className="text-xs text-muted-foreground">{distance.toFixed(1)} km · ~{Math.max(5, Math.round(distance * 3))} min</p>
              <div className="mt-3 space-y-2">
                {RIDE_TYPES.map((r) => {
                  const f = estimateFare(distance, r.id);
                  const active = type === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setType(r.id)}
                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${active ? "border-accent bg-accent/10" : "border-border/60 hover:bg-secondary"}`}
                    >
                      <div>
                        <p className="text-sm font-semibold">{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.desc} · {r.eta} min away</p>
                      </div>
                      <p className="text-sm font-semibold">{formatINR(f)}</p>
                    </button>
                  );
                })}
              </div>
              <Button
                onClick={onRequest}
                disabled={requesting}
                className="mt-4 w-full gradient-accent text-accent-foreground"
              >
                {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Request ${RIDE_TYPES.find(r=>r.id===type)?.label}`}
              </Button>
            </div>
          )}
        </div>

        <div className="h-[70vh] overflow-hidden rounded-2xl border border-border/60 bg-card">
          <RideMap pickup={pickup?.pos ?? null} dropoff={dropoff?.pos ?? null} drivers={nearby} />
        </div>
      </div>
    </div>
  );
}

function PlaceField({
  label, dot, value, onPick,
}: {
  label: string; dot: string; value: string;
  onPick: (p: { address: string; pos: LatLng }) => void;
}) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => { loadGoogleMaps().then(() => setReady(true)).catch(()=>{}); }, []);
  useEffect(() => { setQ(value); }, [value]);

  useEffect(() => {
    if (!ready || q.length < 3) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      const svc = new google.maps.places.AutocompleteService();
      svc.getPlacePredictions({ input: q }, (preds) => setSuggestions(preds ?? []));
    }, 200);
    return () => clearTimeout(t);
  }, [q, ready]);

  const pick = (pred: google.maps.places.AutocompletePrediction) => {
    const svc = new google.maps.places.PlacesService(document.createElement("div"));
    svc.getDetails({ placeId: pred.place_id, fields: ["geometry", "formatted_address"] }, (place) => {
      const loc = place?.geometry?.location;
      if (!loc) return;
      onPick({ address: place.formatted_address ?? pred.description, pos: { lat: loc.lat(), lng: loc.lng() } });
      setQ(place.formatted_address ?? pred.description);
      setOpen(false);
    });
  };

  return (
    <div className="relative">
      <label className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${dot}`} /> {label}
      </label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={ready ? "Search address…" : "Loading maps…"}
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-card">
          {suggestions.slice(0, 5).map((s) => (
            <button
              key={s.place_id}
              onClick={() => pick(s)}
              className="block w-full px-4 py-2.5 text-left text-sm hover:bg-secondary"
            >
              {s.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
