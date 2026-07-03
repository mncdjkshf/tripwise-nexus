import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Car, Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Create account — Tahu cab's" }] }),
  component: Register,
});

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100),
  phone: z.string().trim().regex(/^\d{10}$/, "Enter a valid 10-digit phone"),
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
});

function Register() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, phone: phone.replace(/\D/g, "").slice(-10), email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setLoading(true);
    try {
      // Prevent duplicate phone (uses SECURITY DEFINER RPC — profiles table is not readable to other users)
      const { data: taken } = await supabase.rpc("is_phone_registered", { _phone: parsed.data.phone });
      if (taken) {
        setLoading(false);
        return toast.error("Phone number already registered");
      }

      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { display_name: parsed.data.name, phone: parsed.data.phone },
        },
      });
      if (error) throw error;

      if (data.user) {
        await supabase.from("profiles").update({
          display_name: parsed.data.name,
          first_name: parsed.data.name.split(" ")[0] ?? null,
          last_name: parsed.data.name.split(" ").slice(1).join(" ") || null,
          phone: parsed.data.phone,
          is_validated: true,
        }).eq("user_id", data.user.id);
      }
      toast.success("Account created");
      nav({ to: "/ride" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center px-6 py-10">
      <div className="glass w-full max-w-md rounded-3xl p-8 shadow-elegant">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg gradient-accent"><Car className="h-4 w-4 text-accent-foreground" /></div>
          <span className="text-lg font-bold">Tahu cab's</span>
        </Link>
        <h1 className="mt-6 text-2xl font-bold">Create your Tahu Cabs account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quick sign-up — start riding in seconds.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <Input id="phone" inputMode="numeric" placeholder="10-digit mobile" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" type="email" className="pl-9" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password (min 8)</Label>
            <Input id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full gradient-accent text-accent-foreground">
            {loading ? "Creating…" : "Continue"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Have an account? <Link to="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
