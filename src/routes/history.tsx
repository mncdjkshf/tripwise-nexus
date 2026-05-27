import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { NavBar } from "@/components/nav-bar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Ride = Database["public"]["Tables"]["rides"]["Row"];

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Ride history — Tahu cab's" }] }),
  component: History,
});

function History() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [rides, setRides] = useState<Ride[]>([]);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [loading, user, nav]);
  useEffect(() => {
    if (!user) return;
    supabase.from("rides").select("*").or(`rider_id.eq.${user.id},driver_id.eq.${user.id}`)
      .order("created_at", { ascending: false }).then(({ data }) => setRides(data ?? []));
  }, [user]);

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-bold">Your rides</h1>
        <div className="mt-6 space-y-2">
          {rides.map((r) => (
            <Link key={r.id} to="/track/$rideId" params={{ rideId: r.id }} className="block rounded-2xl border border-border/60 bg-card p-4 hover:bg-secondary">
              <div className="flex justify-between">
                <span className="text-sm font-semibold">{formatINR(r.fare)} · {r.ride_type}</span>
                <span className="text-xs text-muted-foreground">{r.status}</span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{r.pickup_address} → {r.dropoff_address}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
            </Link>
          ))}
          {rides.length === 0 && <p className="text-sm text-muted-foreground">No rides yet.</p>}
        </div>
      </div>
    </div>
  );
}
