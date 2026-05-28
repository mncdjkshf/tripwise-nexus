import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Car, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requestOtp, verifyOtp, markProfileValidated } from "@/lib/otp.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Create account — Tahu cab's" }] }),
  component: Register,
});

type Stage = "form" | "otp";

function Register() {
  const nav = useNavigate();
  const [stage, setStage] = useState<Stage>("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [debugHint, setDebugHint] = useState<string | null>(null);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone.replace(/\D/g, "").slice(-10))) {
      return toast.error("Enter a valid 10-digit phone number");
    }
    setLoading(true);
    try {
      const res = await requestOtp({ data: { identifier: email, channel: "email", email, phone } });
      if (res.debug_code) {
        setDebugHint(res.debug_code);
        toast.success(`OTP sent (demo): ${res.debug_code}`, { duration: 10000 });
      } else {
        toast.success(`6-digit code sent to ${email}`);
      }
      setStage("otp");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyAndCreate = async () => {
    setLoading(true);
    try {
      const v = await verifyOtp({ data: { identifier: email, code: otp } });
      if (!v.ok) {
        setLoading(false);
        return toast.error(v.reason === "expired" ? "Code expired" : "Incorrect code");
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { display_name: `${firstName} ${lastName}`.trim(), first_name: firstName, last_name: lastName, phone },
        },
      });
      if (error) throw error;
      // Persist names + phone on profile, then mark validated.
      if (data.user) {
        await supabase
          .from("profiles")
          .update({ first_name: firstName, last_name: lastName, phone, display_name: `${firstName} ${lastName}`.trim() })
          .eq("user_id", data.user.id);
        await markProfileValidated({ data: { user_id: data.user.id } });
      }
      toast.success("Account verified & created");
      nav({ to: "/ride" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (otp.length === 6 && !loading) verifyAndCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center px-6 py-10">
      <div className="glass w-full max-w-md rounded-3xl p-8 shadow-elegant">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg gradient-accent"><Car className="h-4 w-4 text-accent-foreground" /></div>
          <span className="text-lg font-bold">Tahu cab's</span>
        </Link>

        {stage === "form" ? (
          <>
            <h1 className="mt-6 text-2xl font-bold">Create your account</h1>
            <p className="mt-1 text-sm text-muted-foreground">We'll email you a 6-digit code to verify.</p>

            <form onSubmit={sendOtp} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first">First name</Label>
                  <Input id="first" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last">Last name</Label>
                  <Input id="last" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" className="pl-9" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" inputMode="numeric" placeholder="10-digit mobile number" required value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password (min 8)</Label>
                <Input id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full gradient-accent text-accent-foreground">
                {loading ? "Sending OTP…" : "Send OTP"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-bold">Verify your email</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code sent to {email}.</p>
            {debugHint && (
              <p className="mt-2 rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                Dev mode: code is <span className="font-mono font-semibold text-foreground">{debugHint}</span>
              </p>
            )}
            <div className="mt-6 flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={loading}>
                <InputOTPGroup>
                  {[0,1,2,3,4,5].map((i) => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button onClick={verifyAndCreate} disabled={loading || otp.length !== 6} className="mt-6 w-full gradient-accent text-accent-foreground">
              {loading ? "Verifying…" : "Verify & create account"}
            </Button>
            <button onClick={() => { setStage("form"); setOtp(""); }} className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground">
              ← Edit details
            </button>
          </>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Have an account? <Link to="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
