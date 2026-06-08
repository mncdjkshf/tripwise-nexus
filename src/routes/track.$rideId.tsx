import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { RideMap } from "@/components/ride-map";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import { cancelRide, rateRide } from "@/lib/ride-lifecycle.functions";
import type { Database } from "@/integrations/supabase/types";

type Ride = Database["public"]["Tables"]["rides"]["Row"];

export const Route = createFileRoute("/track/$rideId")({
  head: () => ({ meta: [{ title: "Tracking — Tahu cab's" }] }),
  component: Track,
});

const STEPS: { k: Ride["status"]; label: string }[] = [
  { k: "requested", label: "Searching for drivers" },
  { k: "accepted", label: "Driver assigned" },
  { k: "arriving", label: "Driver arriving" },
  { k: "in_progress", label: "Trip started" },
  { k: "completed", label: "Completed" },
];

function Track() {
  const { rideId } = Route.useParams();
  const [ride, setRide] = useState<Ride | null>(null);
  // Target (real) driver position from DB
  const [driverTarget, setDriverTarget] = useState<{ lat: number; lng: number } | null>(null);
  // Animated (interpolated) driver position passed to the map
  const [driverAnim, setDriverAnim] = useState<{ lat: number; lng: number } | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    supabase.from("rides").select("*").eq("id", rideId).single().then(({ data }) => setRide(data));
    const ch = supabase
      .channel(`ride-${rideId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `id=eq.${rideId}` },
        (p) => setRide(p.new as Ride))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rideId]);

  useEffect(() => {
    if (!ride?.driver_id) return;
    supabase.from("drivers").select("current_lat,current_lng").eq("user_id", ride.driver_id).single()
      .then(({ data }) => {
        if (data?.current_lat && data?.current_lng) setDriverTarget({ lat: data.current_lat, lng: data.current_lng });
      });
    const ch = supabase
      .channel(`driver-${ride.driver_id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "drivers", filter: `user_id=eq.${ride.driver_id}` },
        (p) => {
          const d = p.new as { current_lat: number | null; current_lng: number | null };
          if (d.current_lat && d.current_lng) setDriverTarget({ lat: d.current_lat, lng: d.current_lng });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ride?.driver_id]);

  // Smoothly interpolate the marker from its current position to the latest target
  useEffect(() => {
    if (!driverTarget) return;
    const from = driverAnim ?? driverTarget;
    const to = driverTarget;
    const start = performance.now();
    const duration = 1200;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out
      const e = 1 - Math.pow(1 - t, 3);
      setDriverAnim({
        lat: from.lat + (to.lat - from.lat) * e,
        lng: from.lng + (to.lng - from.lng) * e,
      });
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverTarget?.lat, driverTarget?.lng]);

  const cancelFn = useServerFn(cancelRide);
  const rateFn = useServerFn(rateRide);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [rated, setRated] = useState(false);

  // Prompt rating once when the ride completes
  useEffect(() => {
    if (ride?.status === "completed" && !rated) setRateOpen(true);
  }, [ride?.status, rated]);

  const submitCancel = async () => {
    setSubmitting(true);
    try {
      await cancelFn({ data: { rideId, reason: reason.trim() || "No reason given" } });
      toast.success("Ride cancelled");
      setCancelOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setSubmitting(false);
    }
  };

  const submitRating = async () => {
    setSubmitting(true);
    try {
      await rateFn({ data: { rideId, stars, comment: comment.trim() || undefined } });
      toast.success("Thanks for the feedback!");
      setRated(true);
      setRateOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to rate");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ride) return <div className="min-h-screen"><NavBar /><div className="p-10 text-muted-foreground">Loading…</div></div>;

  const currentIdx = STEPS.findIndex((s) => s.k === ride.status);

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[400px_1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Trip</p>
            <p className="mt-2 text-sm"><span className="text-accent">●</span> {ride.pickup_address}</p>
            <p className="mt-1 text-sm"><span className="text-destructive">●</span> {ride.dropoff_address}</p>
            <div className="mt-4 flex justify-between text-sm text-muted-foreground">
              <span>{ride.distance_km} km</span>
              <span className="font-semibold text-foreground">{formatINR(ride.fare)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
            <ol className="mt-3 space-y-2">
              {STEPS.map((s, i) => {
                const done = i <= currentIdx && ride.status !== "cancelled";
                return (
                  <li key={s.k} className="flex items-center gap-3 text-sm">
                    <span className={`h-2.5 w-2.5 rounded-full ${done ? "bg-accent" : "bg-muted"}`} />
                    <span className={done ? "" : "text-muted-foreground"}>{s.label}</span>
                  </li>
                );
              })}
            </ol>
            {ride.status === "cancelled" && (
              <div className="mt-3 space-y-1">
                <p className="text-sm text-destructive">Ride cancelled</p>
                {ride.cancellation_reason && (
                  <p className="text-xs text-muted-foreground">Reason: {ride.cancellation_reason}</p>
                )}
              </div>
            )}
          </div>

          {["requested", "accepted", "arriving"].includes(ride.status) && (
            <Button variant="destructive" className="w-full" onClick={() => setCancelOpen(true)}>Cancel ride</Button>
          )}
          {ride.status === "completed" && (
            <>
              <Button variant="outline" className="w-full" onClick={() => setRateOpen(true)}>
                <Star className="mr-2 h-4 w-4" /> Rate your driver
              </Button>
              <Button asChild className="w-full gradient-accent text-accent-foreground"><Link to="/ride">Book another</Link></Button>
            </>
          )}
        </div>

        <div className="h-[70vh] overflow-hidden rounded-2xl border border-border/60 bg-card">
          <RideMap
            pickup={{ lat: ride.pickup_lat, lng: ride.pickup_lng }}
            dropoff={{ lat: ride.dropoff_lat, lng: ride.dropoff_lng }}
            driver={driverAnim}
          />
        </div>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel this ride?</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Tell us why (e.g., changed plans, long wait)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep ride</Button>
            <Button variant="destructive" onClick={submitCancel} disabled={submitting}>
              {submitting ? "Cancelling…" : "Cancel ride"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>How was your ride?</DialogTitle></DialogHeader>
          <div className="flex justify-center gap-2 py-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setStars(n)} aria-label={`${n} stars`}>
                <Star className={`h-8 w-8 ${n <= stars ? "fill-accent text-accent" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Leave a comment (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRated(true); setRateOpen(false); }}>Skip</Button>
            <Button onClick={submitRating} disabled={submitting} className="gradient-accent text-accent-foreground">
              {submitting ? "Submitting…" : "Submit rating"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
