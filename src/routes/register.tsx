import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Car, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const generatedOtp = useRef<string>("");

  const sendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone.replace(/\D/g, "").slice(-10))) {
      return toast.error("Enter a valid 10-digit phone number");
    }
    generatedOtp.current = String(Math.floor(100000 + Math.random() * 900000));
    // Simulated SMS — surface the OTP in the UI so the user can complete the flow
    toast.success(`OTP sent to +91 ${phone.slice(-10)} — demo code: ${generatedOtp.current}`, { duration: 10000 });
    setStage("otp");
  };

  const verifyAndCreate = async () => {
    if (otp !== generatedOtp.current) return toast.error("Incorrect OTP");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: name, phone },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account verified & created");
    nav({ to: "/ride" });
  };

  const onGoogle = async () => {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error(res.error.message ?? "Google sign-in failed");
  };

  useEffect(() => {
    if (otp.length === 6) verifyAndCreate();
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
            <p className="mt-1 text-sm text-muted-foreground">Verify your phone, then start riding.</p>

            <form onSubmit={sendOtp} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="phone" className="pl-9" inputMode="numeric" placeholder="10-digit mobile number" required value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password (min 8)</Label>
                <Input id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full gradient-accent text-accent-foreground">
                Send OTP
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={onGoogle}>Continue with Google</Button>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-bold">Verify phone</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code we sent to +91 {phone.slice(-10)}.</p>
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
