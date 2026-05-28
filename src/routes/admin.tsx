import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ShieldAlert } from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { RideMap } from "@/components/ride-map";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import { listAllDrivers, setDriverApproval } from "@/lib/driver-admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Tahu cab's" }] }),
  component: Admin,
});

type AdminDriver = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  car_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_type: string;
  driving_license: string | null;
  personal_details_json: Record<string, unknown> | null;
  is_approved: boolean;
  status: string;
  rating: number;
  total_rides: number;
  created_at: string;
};

function Admin() {
  const { user, loading, roles } = useAuth();
  const nav = useNavigate();
  const fetchDrivers = useServerFn(listAllDrivers);
  const approve = useServerFn(setDriverApproval);

  const [stats, setStats] = useState({ users: 0, drivers: 0, rides: 0, revenue: 0 });
  const [liveDrivers, setLiveDrivers] = useState<{ lat: number; lng: number }[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [allDrivers, setAllDrivers] = useState<AdminDriver[]>([]);
  const [tab, setTab] = useState<"pending" | "approved">("pending");

  useEffect(() => { if (!loading && (!user || !roles.includes("admin"))) nav({ to: "/" }); }, [loading, user, roles, nav]);

  const loadAll = async () => {
    const [{ count: u }, { count: d }, { count: r }, { data: rides }, { data: online }, driversRes] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("drivers").select("*", { count: "exact", head: true }),
      supabase.from("rides").select("*", { count: "exact", head: true }),
      supabase.from("rides").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("drivers").select("current_lat,current_lng").neq("status", "offline"),
      fetchDrivers().catch((e) => { console.error(e); return { drivers: [] }; }),
    ]);
    const rev = (rides ?? []).filter((x) => x.status === "completed").reduce((s, x) => s + Number(x.fare), 0);
    setStats({ users: u ?? 0, drivers: d ?? 0, rides: r ?? 0, revenue: rev });
    setRecent(rides ?? []);
    setLiveDrivers((online ?? []).filter((o: any) => o.current_lat && o.current_lng).map((o: any) => ({ lat: o.current_lat, lng: o.current_lng })));
    setAllDrivers((driversRes.drivers ?? []) as AdminDriver[]);
  };

  useEffect(() => {
    if (!roles.includes("admin")) return;
    loadAll();
    const ch = supabase.channel("admin").on("postgres_changes", { event: "*", schema: "public", table: "rides" }, loadAll).subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles.join(",")]);

  const handleApprove = async (driverId: string, approved: boolean) => {
    try {
      await approve({ data: { driver_id: driverId, approved } });
      toast.success(approved ? "Driver approved" : "Driver suspended");
      setAllDrivers((d) => d.map((x) => (x.id === driverId ? { ...x, is_approved: approved } : x)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  const pending = allDrivers.filter((d) => !d.is_approved);
  const approved = allDrivers.filter((d) => d.is_approved);
  const visible = tab === "pending" ? pending : approved;

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <h1 className="text-2xl font-bold">Admin dashboard</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Riders" value={stats.users} />
          <Stat label="Drivers" value={stats.drivers} />
          <Stat label="Total rides" value={stats.rides} />
          <Stat label="Revenue" value={formatINR(stats.revenue)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="h-[420px] overflow-hidden rounded-2xl border border-border/60 bg-card">
            <RideMap drivers={liveDrivers} />
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h2 className="text-sm font-semibold text-muted-foreground">Recent rides</h2>
            <div className="mt-3 space-y-2 max-h-[360px] overflow-auto">
              {recent.map((r) => (
                <Link key={r.id} to="/track/$rideId" params={{ rideId: r.id }} className="block rounded-xl border border-border/60 p-3 text-sm hover:bg-secondary">
                  <div className="flex justify-between">
                    <span className="font-semibold">{formatINR(r.fare)}</span>
                    <span className="text-xs text-muted-foreground">{r.status}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{r.pickup_address} → {r.dropoff_address}</p>
                </Link>
              ))}
              {recent.length === 0 && <p className="text-sm text-muted-foreground">No rides yet.</p>}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldAlert className="h-4 w-4 text-accent" />
              Driver verification
            </h2>
            <div className="flex gap-1 rounded-lg bg-secondary p-1 text-xs">
              <button onClick={() => setTab("pending")} className={`rounded-md px-3 py-1.5 ${tab === "pending" ? "bg-background font-semibold" : ""}`}>
                Pending ({pending.length})
              </button>
              <button onClick={() => setTab("approved")} className={`rounded-md px-3 py-1.5 ${tab === "approved" ? "bg-background font-semibold" : ""}`}>
                Approved ({approved.length})
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {visible.length === 0 && (
              <p className="text-sm text-muted-foreground">No drivers in this list.</p>
            )}
            {visible.map((d) => (
              <details key={d.id} className="rounded-xl border border-border/60 bg-secondary/40 p-4">
                <summary className="flex cursor-pointer items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{d.full_name ?? "Unnamed driver"}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.vehicle_type} · {d.car_number ?? "—"} · {d.email ?? "no email"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.is_approved ? (
                      <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); handleApprove(d.id, false); }}>
                        <XCircle className="mr-1 h-4 w-4" /> Suspend
                      </Button>
                    ) : (
                      <Button size="sm" onClick={(e) => { e.preventDefault(); handleApprove(d.id, true); }} className="gradient-accent text-accent-foreground">
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                      </Button>
                    )}
                  </div>
                </summary>
                <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                  <Detail label="Phone" value={d.phone_number ?? "—"} />
                  <Detail label="Driving license" value={d.driving_license ?? "—"} sensitive />
                  <Detail label="Vehicle" value={`${d.vehicle_make ?? ""} ${d.vehicle_model ?? ""}`.trim() || "—"} />
                  <Detail label="Status" value={d.status} />
                  <Detail label="Rating" value={`★ ${Number(d.rating).toFixed(1)} (${d.total_rides} rides)`} />
                  <Detail label="Applied" value={new Date(d.created_at).toLocaleString()} />
                </div>
                {d.personal_details_json && (
                  <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive">Sensitive personal details</p>
                    <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-foreground">
                      {JSON.stringify(d.personal_details_json, null, 2)}
                    </pre>
                  </div>
                )}
              </details>
            ))}
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

function Detail({ label, value, sensitive }: { label: string; value: string; sensitive?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 ${sensitive ? "font-mono text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
