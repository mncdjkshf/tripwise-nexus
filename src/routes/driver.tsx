import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { NavBar } from "@/components/nav-bar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Driver = Database["public"]["Tables"]["drivers"]["Row"];
type Ride = Database["public"]["Tables"]["rides"]["Row"];

export const Route = createFileRoute("/driver")({
  head: () => ({ meta: [{ title: "Driver — Tahu cab's" }] }),
  component: DriverDashboard,
});

function DriverDashboard() {
  const { user, loading, roles } = useAuth();
  const nav = useNavigate();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [requests, setRequests] = useState<Ride[]>([]);
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [loading, user, nav]);
  useEffect(() => { if (!loading && user && !roles.includes("driver")) nav({ to: "/become-driver" }); }, [loading, user, roles, nav]);

  // Load driver row
  useEffect(() => {
    if (!user) return;
    supabase.from("drivers").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => setDriver(data));
  }, [user]);

  // Watch open requests + my assigned active ride
  useEffect(() => {
    if (!user) return;
    const refresh = async () => {
      const { data: open } = await supabase.from("rides").select("*").is("driver_id", null).eq("status", "requested").order("requested_at", { ascending: false }).limit(10);
      setRequests(open ?? []);
      const { data: mine } = await supabase.from("rides").select("*").eq("driver_id", user.id).in("status", ["accepted","arriving","in_progress"]).order("accepted_at", { ascending: false }).limit(1);
      setCurrentRide(mine?.[0] ?? null);
    };
    refresh();
    const ch = supabase.channel("driver-feed").on("postgres_changes", { event: "*", schema: "public", table: "rides" }, refresh).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Push location while online
  useEffect(() => {
    if (!driver || driver.status === "offline") return;
    let id: number | null = null;
    if (navigator.geolocation) {
      id = navigator.geolocation.watchPosition(
        (p) => {
          supabase.from("drivers").update({ current_lat: p.coords.latitude, current_lng: p.coords.longitude }).eq("user_id", driver.user_id);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
    }
    return () => { if (id !== null) navigator.geolocation.clearWatch(id); };
  }, [driver]);

  const setOnline = async (online: boolean) => {
    if (!driver) return;
    const { data } = await supabase.from("drivers").update({ status: online ? "online" : "offline" }).eq("user_id", driver.user_id).select().single();
    setDriver(data);
  };

  const accept = async (ride: Ride) => {
    if (!user) return;
    const { error } = await supabase.from("rides").update({
      driver_id: user.id, status: "accepted", accepted_at: new Date().toISOString(),
    }).eq("id", ride.id).is("driver_id", null);
    if (error) return toast.error(error.message);
    toast.success("Ride accepted");
  };

  const reject = async (ride: Ride) => {
    if (!user) return;
    const current = (ride.rejected_driver_ids ?? []) as string[];
    if (current.includes(user.id)) {
      setRequests((rs) => rs.filter((r) => r.id !== ride.id));
      return;
    }
    const { error } = await supabase
      .from("rides")
      .update({ rejected_driver_ids: [...current, user.id] })
      .eq("id", ride.id)
      .is("driver_id", null);
    if (error) return toast.error(error.message);
    setRequests((rs) => rs.filter((r) => r.id !== ride.id));
    toast.message("Request declined");
  };

  const toggleBusy = async () => {
    if (!driver) return;
    const next = driver.status === "on_ride" ? "online" : "on_ride";
    const { data, error } = await supabase
      .from("drivers")
      .update({ status: next })
      .eq("user_id", driver.user_id)
      .select()
      .single();
    if (error) return toast.error(error.message);
    setDriver(data);
    toast.success(next === "on_ride" ? "Marked as busy" : "You're available again");
  };


  const updateStatus = async (status: Ride["status"]) => {
    if (!currentRide) return;
    const patch: Partial<Ride> = { status };
    if (status === "in_progress") patch.started_at = new Date().toISOString();
    if (status === "completed") patch.completed_at = new Date().toISOString();
    await supabase.from("rides").update(patch).eq("id", currentRide.id);
    if (status === "completed") toast.success("Trip complete");
  };

  if (!driver) {
    return <div className="min-h-screen"><NavBar /><div className="p-10 text-muted-foreground">Loading driver profile…</div></div>;
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-5">
          <div>
            <p className="text-xs text-muted-foreground">Driver mode</p>
            <p className="mt-1 text-xl font-bold">
              {driver.status === "offline" ? "You're offline" : driver.status === "on_ride" ? "You're busy" : "You're online"}
            </p>
            <p className="text-xs text-muted-foreground">{driver.vehicle_make} {driver.vehicle_model} · {driver.vehicle_plate}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant={driver.status === "on_ride" ? "default" : "outline"}
              size="sm"
              onClick={toggleBusy}
              disabled={driver.status === "offline"}
            >
              {driver.status === "on_ride" ? "Busy" : "Mark busy"}
            </Button>
            <Switch checked={driver.status !== "offline"} onCheckedChange={setOnline} />
          </div>
        </div>


        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Rides" value={driver.total_rides} />
          <Stat label="Earnings" value={formatINR(driver.total_earnings)} />
          <Stat label="Rating" value={`${Number(driver.rating).toFixed(2)} ★`} />
        </div>

        {currentRide ? (
          <div className="rounded-2xl border border-accent/40 bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-accent">Current trip</p>
            <p className="mt-2 text-sm"><span className="text-accent">●</span> {currentRide.pickup_address}</p>
            <p className="mt-1 text-sm"><span className="text-destructive">●</span> {currentRide.dropoff_address}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {currentRide.status === "accepted" && <Button onClick={() => updateStatus("arriving")}>I'm on the way</Button>}
              {currentRide.status === "arriving" && <Button onClick={() => updateStatus("in_progress")}>Start trip</Button>}
              {currentRide.status === "in_progress" && <Button onClick={() => updateStatus("completed")} className="gradient-accent text-accent-foreground">End trip</Button>}
              <Button asChild variant="outline"><Link to="/track/$rideId" params={{ rideId: currentRide.id }}>View map</Link></Button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Incoming requests</h2>
            {driver.status === "offline" && <p className="text-sm text-muted-foreground">Go online to receive requests.</p>}
            {driver.status !== "offline" && requests.length === 0 && (
              <p className="text-sm text-muted-foreground">No requests yet. Hang tight.</p>
            )}
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4">
                  <div>
                    <p className="text-sm font-semibold">{formatINR(r.fare)} · {r.distance_km} km · {r.ride_type}</p>
                    <p className="text-xs text-muted-foreground">{r.pickup_address} → {r.dropoff_address}</p>
                  </div>
                  <Button onClick={() => accept(r)} className="gradient-accent text-accent-foreground">Accept</Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
