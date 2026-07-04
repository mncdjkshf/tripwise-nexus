import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { NavBar } from "@/components/nav-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/driver-profile")({
  head: () => ({ meta: [{ title: "My profile — Tahu cab's" }] }),
  component: DriverProfile,
});

function DriverProfile() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", phone_number: "",
    address: "", emergency_contact: "", date_of_birth: "", gender: "",
  });

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    supabase.from("drivers_private")
      .select("full_name,email,phone_number,address,emergency_contact,date_of_birth,gender")
      .eq("user_id", user.id).maybeSingle().then(({ data }) => {
        if (data) setForm({
          full_name: data.full_name ?? "",
          email: data.email ?? "",
          phone_number: data.phone_number ?? "",
          address: data.address ?? "",
          emergency_contact: data.emergency_contact ?? "",
          date_of_birth: data.date_of_birth ?? "",
          gender: data.gender ?? "",
        });
      });
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("drivers_private").update(form).eq("user_id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  };

  if (!user) return <div className="min-h-screen"><NavBar /><div className="p-10 text-muted-foreground">Loading…</div></div>;

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/driver"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link></Button>
        <h1 className="text-2xl font-bold">My profile</h1>
        <p className="text-sm text-muted-foreground">Keep your details up to date.</p>

        <form onSubmit={save} className="mt-6 rounded-2xl border border-border/60 bg-card p-5 space-y-4">
          <F label="Full name"><Input required value={form.full_name} onChange={(e)=>setForm({...form, full_name:e.target.value})} /></F>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Email"><Input type="email" required value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} /></F>
            <F label="Mobile"><Input inputMode="numeric" maxLength={10} value={form.phone_number} onChange={(e)=>setForm({...form, phone_number:e.target.value.replace(/\D/g,"")})} /></F>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Date of birth"><Input type="date" value={form.date_of_birth} onChange={(e)=>setForm({...form, date_of_birth:e.target.value})} /></F>
            <F label="Gender">
              <select value={form.gender} onChange={(e)=>setForm({...form, gender:e.target.value})} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </F>
          </div>
          <F label="Address"><Textarea value={form.address} onChange={(e)=>setForm({...form, address:e.target.value})} /></F>
          <F label="Emergency contact"><Input inputMode="numeric" maxLength={10} value={form.emergency_contact} onChange={(e)=>setForm({...form, emergency_contact:e.target.value.replace(/\D/g,"")})} /></F>

          <Button type="submit" disabled={saving} className="w-full gradient-accent text-accent-foreground">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
