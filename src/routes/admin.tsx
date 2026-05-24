import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { NavBar } from "@/components/nav-bar";
import { RideMap } from "@/components/ride-map";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Swift" }] }),
  component: Admin,
});

function Admin() {
  const { user, loading, roles } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState({ users: 0, drivers: 0, rides: 0, revenue: 0 });
  const [drivers, setDrivers] = useState<{ lat: number; lng: number }[]>([]);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => { if (!loading && (!user || !roles.includes("admin"))) nav({ to: "/" }); }, [loading, user, roles, nav]);

  useEffect(() => {
    const load = async () => {
      const [{ count: u }, { count: d }, { count: r }, { data: rides }, { data: online }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("drivers").select("*", { count: "exact", head: true }),
        supabase.from("rides").select("*", { count: "exact", head: true }),
        supabase.from("rides").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("drivers").select("current_lat,current_lng").neq("status", "offline"),
      ]);
      const rev = (rides ?? []).filter((x) => x.status === "completed").reduce((s, x) => s + Number(x.fare), 0);
      setStats({ users: u ?? 0, drivers: d ?? 0, rides: r ?? 0, revenue: rev });
      setRecent(rides ?? []);
      setDrivers((online ?? []).filter((o: any) => o.current_lat && o.current_lng).map((o: any) => ({ lat: o.current_lat, lng: o.current_lng })));
    };
    load();
    const ch = supabase.channel("admin").on("postgres_changes", { event: "*", schema: "public", table: "rides" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <h1 className="text-2xl font-bold">Admin dashboard</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Riders" value={stats.users} />
          <Stat label="Drivers" value={stats.drivers} />
          <Stat label="Total rides" value={stats.rides} />
          <Stat label="Revenue" value={`$${stats.revenue.toFixed(2)}`} />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="h-[480px] overflow-hidden rounded-2xl border border-border/60 bg-card">
            <RideMap drivers={drivers} />
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h2 className="text-sm font-semibold text-muted-foreground">Recent rides</h2>
            <div className="mt-3 space-y-2 max-h-[420px] overflow-auto">
              {recent.map((r) => (
                <Link key={r.id} to="/track/$rideId" params={{ rideId: r.id }} className="block rounded-xl border border-border/60 p-3 text-sm hover:bg-secondary">
                  <div className="flex justify-between">
                    <span className="font-semibold">${r.fare}</span>
                    <span className="text-xs text-muted-foreground">{r.status}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{r.pickup_address} → {r.dropoff_address}</p>
                </Link>
              ))}
              {recent.length === 0 && <p className="text-sm text-muted-foreground">No rides yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
