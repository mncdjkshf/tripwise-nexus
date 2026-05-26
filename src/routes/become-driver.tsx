import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { NavBar } from "@/components/nav-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/become-driver")({
  head: () => ({ meta: [{ title: "Become a driver — Tahu cab's" }] }),
  component: BecomeDriver,
});

function BecomeDriver() {
  const { user, loading, roles, refreshRoles } = useAuth();
  const nav = useNavigate();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [type, setType] = useState("economy");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [loading, user, nav]);
  useEffect(() => { if (roles.includes("driver")) nav({ to: "/driver" }); }, [roles, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error: e1 } = await supabase.from("drivers").insert({
      user_id: user.id, vehicle_make: make, vehicle_model: model, vehicle_plate: plate, vehicle_type: type,
    });
    if (e1) { setSubmitting(false); return toast.error(e1.message); }
    const { error: e2 } = await supabase.from("user_roles").insert({ user_id: user.id, role: "driver" });
    setSubmitting(false);
    if (e2 && !e2.message.includes("duplicate")) return toast.error(e2.message);
    await refreshRoles();
    toast.success("You're a driver now!");
    nav({ to: "/driver" });
  };

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="mx-auto max-w-md px-6 py-12">
        <h1 className="text-2xl font-bold">Become a driver</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tell us about your vehicle.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Make</Label><Input required value={make} onChange={(e)=>setMake(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Model</Label><Input required value={model} onChange={(e)=>setModel(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>License plate</Label><Input required value={plate} onChange={(e)=>setPlate(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Vehicle class</Label>
            <select value={type} onChange={(e)=>setType(e.target.value)} className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm">
              <option value="economy">Economy</option>
              <option value="premium">Premium</option>
              <option value="bike">Bike</option>
              <option value="suv">SUV</option>
            </select>
          </div>
          <Button type="submit" disabled={submitting} className="w-full gradient-accent text-accent-foreground">
            {submitting ? "Submitting…" : "Start driving"}
          </Button>
        </form>
      </div>
    </div>
  );
}
