import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { NavBar } from "@/components/nav-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/become-driver")({
  head: () => ({ meta: [{ title: "Become a driver — Tahu cab's" }] }),
  component: BecomeDriver,
});

function BecomeDriver() {
  const { user, loading, roles, refreshRoles } = useAuth();
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [carNumber, setCarNumber] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [type, setType] = useState("economy");
  const [license, setLicense] = useState("");
  const [address, setAddress] = useState("");
  const [dob, setDob] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [backgroundNotes, setBackgroundNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [loading, user, nav]);
  useEffect(() => { if (roles.includes("driver")) nav({ to: "/driver" }); }, [roles, nav]);
  useEffect(() => { if (user?.email && !email) setEmail(user.email); }, [user, email]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error: e1 } = await supabase.from("drivers").insert({
      user_id: user.id,
      full_name: fullName,
      email,
      phone_number: phone,
      car_number: carNumber,
      vehicle_make: make,
      vehicle_model: model,
      vehicle_plate: carNumber,
      vehicle_type: type,
      driving_license: license,
      personal_details_json: {
        address,
        date_of_birth: dob,
        emergency_contact: emergencyContact,
        background_notes: backgroundNotes,
        submitted_at: new Date().toISOString(),
      },
      is_approved: false,
    });
    if (e1) { setSubmitting(false); return toast.error(e1.message); }
    const { error: e2 } = await supabase.from("user_roles").insert({ user_id: user.id, role: "driver" });
    setSubmitting(false);
    if (e2 && !e2.message.includes("duplicate")) return toast.error(e2.message);
    await refreshRoles();
    toast.success("Application submitted — pending admin approval");
    nav({ to: "/driver" });
  };

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold">Drive with Tahu cab's</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit your details. Sensitive fields (license, address, background) are visible only to admins for verification.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-6">
          <Section title="Personal details">
            <Field label="Full legal name"><Input required value={fullName} onChange={(e)=>setFullName(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email"><Input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} /></Field>
              <Field label="Phone number"><Input required inputMode="numeric" value={phone} onChange={(e)=>setPhone(e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of birth"><Input type="date" required value={dob} onChange={(e)=>setDob(e.target.value)} /></Field>
              <Field label="Emergency contact"><Input required value={emergencyContact} onChange={(e)=>setEmergencyContact(e.target.value)} /></Field>
            </div>
            <Field label="Residential address"><Textarea required value={address} onChange={(e)=>setAddress(e.target.value)} /></Field>
          </Section>

          <Section title="Vehicle">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Car number / plate"><Input required value={carNumber} onChange={(e)=>setCarNumber(e.target.value)} /></Field>
              <Field label="Vehicle class">
                <select value={type} onChange={(e)=>setType(e.target.value)} className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm">
                  <option value="economy">Economy (TahuGo)</option>
                  <option value="premium">Premium (TahuPrime)</option>
                  <option value="bike">Bike (TahuMoto)</option>
                  <option value="suv">SUV (TahuXL)</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Make"><Input required value={make} onChange={(e)=>setMake(e.target.value)} /></Field>
              <Field label="Model"><Input required value={model} onChange={(e)=>setModel(e.target.value)} /></Field>
            </div>
          </Section>

          <Section title="Verification (admin-only)">
            <Field label="Driving license number"><Input required value={license} onChange={(e)=>setLicense(e.target.value)} /></Field>
            <Field label="Background notes / prior convictions">
              <Textarea
                placeholder="Disclose any issues an admin should review"
                value={backgroundNotes}
                onChange={(e)=>setBackgroundNotes(e.target.value)}
              />
            </Field>
          </Section>

          <Button type="submit" disabled={submitting} className="w-full gradient-accent text-accent-foreground">
            {submitting ? "Submitting…" : "Submit for approval"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
