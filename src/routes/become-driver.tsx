import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, User, FileImage, ShieldCheck } from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploader } from "@/components/file-uploader";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { syncDriverToSheet } from "@/lib/driver-sheet.functions";

export const Route = createFileRoute("/become-driver")({
  head: () => ({ meta: [{ title: "Become a driver — Tahu cab's" }] }),
  component: BecomeDriver,
});

type Step = 1 | 2 | 3 | 4;

function BecomeDriver() {
  const { user, loading, roles, refreshRoles } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>(1);

  // Step 1: personal
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  // Step 2: photo + vehicle
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [carNumber, setCarNumber] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [type, setType] = useState("economy");

  // Step 3: documents
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarFront, setAadhaarFront] = useState<string | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<string | null>(null);
  const [panNumber, setPanNumber] = useState("");
  const [pan, setPan] = useState<string | null>(null);
  const [license, setLicense] = useState("");
  const [dlImage, setDlImage] = useState<string | null>(null);

  // Step 4: review + consent
  const [declaration, setDeclaration] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [loading, user, nav]);
  useEffect(() => { if (roles.includes("driver")) nav({ to: "/driver" }); }, [roles, nav]);
  useEffect(() => { if (user?.email && !email) setEmail(user.email); }, [user, email]);

  const cleanPhone = phone.replace(/\D/g, "").slice(-10);

  const validateStep = (s: Step): string | null => {
    if (s === 1) {
      if (fullName.trim().length < 3) return "Enter your full name (min 3 characters)";
      if (!/^[a-zA-Z\s.'-]+$/.test(fullName.trim())) return "Name should contain letters only";
      if (!/^\S+@\S+\.\S+$/.test(email)) return "Enter a valid email";
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) return "Enter a valid 10-digit Indian mobile number";
      if (!dob) return "Date of birth is required";
      if (!gender) return "Select gender";
      if (address.trim().length < 8) return "Enter your full address";
      if (!/^\d{10}$/.test(emergencyContact.replace(/\D/g, ""))) return "Emergency contact must be 10 digits";
    }
    if (s === 2) {
      if (!profilePhoto) return "Upload a profile photo";
      if (!carNumber.trim()) return "Enter your vehicle number";
      if (!make.trim() || !model.trim()) return "Enter vehicle make and model";
    }
    if (s === 3) {
      if (!/^\d{12}$/.test(aadhaarNumber.replace(/\s/g, ""))) return "Aadhaar must be 12 digits";
      if (!aadhaarFront || !aadhaarBack) return "Upload both sides of Aadhaar";
      if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(panNumber.toUpperCase())) return "Enter a valid PAN number";
      if (!pan) return "Upload PAN card image";
      if (!license.trim()) return "Enter your driving licence number";
      if (!dlImage) return "Upload driving licence image";
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) return toast.error(err);
    setStep((s) => (Math.min(4, s + 1) as Step));
  };
  const prev = () => setStep((s) => (Math.max(1, s - 1) as Step));

  const onSubmit = async () => {
    if (!user) return;
    if (!declaration) return toast.error("Please confirm the declaration");
    for (const s of [1, 2, 3] as Step[]) {
      const err = validateStep(s);
      if (err) { setStep(s); return toast.error(err); }
    }
    setSubmitting(true);

    const { data: inserted, error: e1 } = await supabase.from("drivers").insert({
      user_id: user.id,
      vehicle_make: make,
      vehicle_model: model,
      vehicle_plate: carNumber,
      vehicle_type: type,
      is_approved: false,
    }).select("id").maybeSingle();
    if (e1) { setSubmitting(false); return toast.error(e1.message); }

    const { error: ePriv } = await supabase.from("drivers_private").upsert({
      user_id: user.id,
      full_name: fullName,
      email,
      phone_number: cleanPhone,
      car_number: carNumber,
      driving_license: license,
      profile_photo_url: profilePhoto,
      aadhaar_number: aadhaarNumber.replace(/\s/g, ""),
      aadhaar_front_url: aadhaarFront,
      aadhaar_back_url: aadhaarBack,
      pan_number: panNumber.toUpperCase(),
      pan_url: pan,
      dl_image_url: dlImage,
      gender,
      date_of_birth: dob,
      address,
      emergency_contact: emergencyContact,
      verification_status: "pending",
    });
    if (ePriv) { setSubmitting(false); return toast.error(ePriv.message); }

    const { error: e2 } = await supabase.from("user_roles").insert({ user_id: user.id, role: "driver" });
    if (e2 && !e2.message.includes("duplicate")) { setSubmitting(false); return toast.error(e2.message); }

    try {
      await syncDriverToSheet({
        data: {
          application_id: inserted?.id ?? "",
          driver_name: fullName, phone: cleanPhone, email, dob,
          emergency_contact: emergencyContact, address,
          vehicle_plate: carNumber, vehicle_class: type, make, model,
          license_number: license, background_notes: "",
          status: "pending_admin_review",
        },
      });
    } catch { /* non-blocking */ }

    await refreshRoles();
    setSubmitting(false);
    toast.success("Application submitted — our team will review it.");
    nav({ to: "/driver" });
  };

  const steps = [
    { n: 1 as Step, label: "Personal", icon: User },
    { n: 2 as Step, label: "Photo & Vehicle", icon: FileImage },
    { n: 3 as Step, label: "Documents", icon: ShieldCheck },
    { n: 4 as Step, label: "Review", icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold sm:text-3xl">Drive with Tahu cab's</h1>
          <p className="mt-1 text-sm text-muted-foreground">A few quick steps to become a verified driver.</p>
        </div>

        {/* Stepper */}
        <div className="mb-8 grid grid-cols-4 gap-2">
          {steps.map((s) => {
            const active = step === s.n;
            const done = step > s.n;
            return (
              <div key={s.n} className="flex flex-col items-center gap-2">
                <div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold transition-colors ${
                  done ? "bg-accent text-accent-foreground" :
                  active ? "bg-foreground text-background" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {done ? <CheckCircle2 className="h-5 w-5" /> : s.n}
                </div>
                <p className={`text-[11px] text-center sm:text-xs ${active ? "font-semibold" : "text-muted-foreground"}`}>{s.label}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-7 space-y-6">
          {step === 1 && (
            <Section title="Personal information" subtitle="How you appear to riders and our team.">
              <Field label="Full legal name"><Input required value={fullName} onChange={(e)=>setFullName(e.target.value)} placeholder="Rajesh Kumar" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email"><Input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} /></Field>
                <Field label="Mobile number">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 place-items-center rounded-md border border-input bg-muted px-3 text-sm">+91</span>
                    <Input required inputMode="numeric" maxLength={10} placeholder="9876543210" value={phone} onChange={(e)=>setPhone(e.target.value)} />
                  </div>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date of birth"><Input type="date" required value={dob} onChange={(e)=>setDob(e.target.value)} /></Field>
                <Field label="Gender">
                  <select value={gender} onChange={(e)=>setGender(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
              </div>
              <Field label="Residential address"><Textarea required value={address} onChange={(e)=>setAddress(e.target.value)} placeholder="House, street, city, PIN" /></Field>
              <Field label="Emergency contact (10 digits)">
                <Input required inputMode="numeric" maxLength={10} value={emergencyContact} onChange={(e)=>setEmergencyContact(e.target.value)} />
              </Field>
            </Section>
          )}

          {step === 2 && user && (
            <Section title="Profile photo & vehicle" subtitle="Riders will see your photo when you accept a trip.">
              <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
                <div className="mx-auto w-full max-w-[200px]">
                  <FileUploader kind="profile" userId={user.id} label="Profile photo" value={profilePhoto} onChange={setProfilePhoto} aspect="square" hint="Max 5MB" />
                </div>
                <div className="space-y-4">
                  <Field label="Vehicle number / plate"><Input required value={carNumber} onChange={(e)=>setCarNumber(e.target.value.toUpperCase())} placeholder="DL01AB1234" /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Make"><Input required value={make} onChange={(e)=>setMake(e.target.value)} placeholder="Maruti" /></Field>
                    <Field label="Model"><Input required value={model} onChange={(e)=>setModel(e.target.value)} placeholder="Dzire" /></Field>
                  </div>
                  <Field label="Vehicle class">
                    <select value={type} onChange={(e)=>setType(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                      <option value="economy">Economy (TahuGo)</option>
                      <option value="premium">Premium (TahuPrime)</option>
                      <option value="bike">Bike (TahuMoto)</option>
                      <option value="suv">SUV (TahuXL)</option>
                    </select>
                  </Field>
                </div>
              </div>
            </Section>
          )}

          {step === 3 && user && (
            <Section title="Verification documents" subtitle="Visible only to our verification team.">
              <div className="space-y-5">
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="mb-3 text-sm font-semibold">Aadhaar card</p>
                  <Field label="Aadhaar number (12 digits)">
                    <Input required inputMode="numeric" maxLength={12} value={aadhaarNumber} onChange={(e)=>setAadhaarNumber(e.target.value.replace(/\D/g,""))} placeholder="1234 5678 9012" />
                  </Field>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <FileUploader kind="aadhaar_front" userId={user.id} label="Aadhaar — Front" value={aadhaarFront} onChange={setAadhaarFront} hint="Max 10MB" />
                    <FileUploader kind="aadhaar_back" userId={user.id} label="Aadhaar — Back" value={aadhaarBack} onChange={setAadhaarBack} hint="Max 10MB" />
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="mb-3 text-sm font-semibold">PAN card</p>
                  <Field label="PAN number">
                    <Input required maxLength={10} value={panNumber} onChange={(e)=>setPanNumber(e.target.value.toUpperCase())} placeholder="ABCDE1234F" />
                  </Field>
                  <div className="mt-4">
                    <FileUploader kind="pan" userId={user.id} label="PAN card image" value={pan} onChange={setPan} hint="Max 10MB" />
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="mb-3 text-sm font-semibold">Driving licence</p>
                  <Field label="Licence number"><Input required value={license} onChange={(e)=>setLicense(e.target.value.toUpperCase())} placeholder="DL-0420110149646" /></Field>
                  <div className="mt-4">
                    <FileUploader kind="dl" userId={user.id} label="Driving licence image" value={dlImage} onChange={setDlImage} hint="Max 10MB" />
                  </div>
                </div>
              </div>
            </Section>
          )}

          {step === 4 && (
            <Section title="Review & submit" subtitle="Confirm your details before submission.">
              <ReviewRow label="Name" value={fullName} />
              <ReviewRow label="Mobile" value={`+91 ${cleanPhone}`} />
              <ReviewRow label="Email" value={email} />
              <ReviewRow label="Date of birth" value={dob} />
              <ReviewRow label="Vehicle" value={`${make} ${model} · ${carNumber}`} />
              <ReviewRow label="Aadhaar" value={aadhaarNumber.replace(/(\d{4})(?=\d)/g, "$1 ")} />
              <ReviewRow label="PAN" value={panNumber.toUpperCase()} />
              <ReviewRow label="Licence" value={license} />

              <label className="mt-4 flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 cursor-pointer">
                <Checkbox checked={declaration} onCheckedChange={(v) => setDeclaration(v === true)} className="mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  I confirm the uploaded documents belong to me and agree to the Terms & Conditions and Privacy Policy.
                </span>
              </label>
            </Section>
          )}

          <div className="flex items-center justify-between border-t border-border/60 pt-5">
            <Button type="button" variant="outline" onClick={prev} disabled={step === 1}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={next} className="gradient-accent text-accent-foreground">
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" disabled={submitting || !declaration} onClick={onSubmit} className="gradient-accent text-accent-foreground">
                {submitting ? "Submitting…" : "Submit application"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="space-y-4">{children}</div>
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/40 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
