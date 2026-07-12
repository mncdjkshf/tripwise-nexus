import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  User,
  FileImage,
  ShieldCheck,
  Banknote,
  Loader2,
} from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploader } from "@/components/file-uploader";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getSignedDriverUrl } from "@/lib/driver-storage";
import { syncDriverToSheet } from "@/lib/driver-sheet.functions";

export const Route = createFileRoute("/become-driver")({
  head: () => ({ meta: [{ title: "Become a driver — Tahu cab's" }] }),
  component: BecomeDriver,
});

type Step = 1 | 2 | 3 | 4 | 5;

type Draft = {
  step: Step;
  fullName: string; email: string; phone: string; dob: string; gender: string;
  address: string; city: string; state: string; pinCode: string; emergencyContact: string;
  profilePhoto: string | null; carNumber: string; make: string; model: string; type: string;
  registrationNumber: string; insuranceNumber: string; insuranceExpiry: string; experienceYears: string;
  aadhaarNumber: string; aadhaarFront: string | null; aadhaarBack: string | null;
  panNumber: string; pan: string | null;
  license: string; dlImage: string | null; dlBack: string | null;
  rc: string | null; insuranceDoc: string | null;
  bankAccountHolder: string; bankAccountNumber: string; bankIfsc: string; upiId: string;
};

const emptyDraft: Draft = {
  step: 1,
  fullName: "", email: "", phone: "", dob: "", gender: "",
  address: "", city: "", state: "", pinCode: "", emergencyContact: "",
  profilePhoto: null, carNumber: "", make: "", model: "", type: "economy",
  registrationNumber: "", insuranceNumber: "", insuranceExpiry: "", experienceYears: "",
  aadhaarNumber: "", aadhaarFront: null, aadhaarBack: null,
  panNumber: "", pan: null,
  license: "", dlImage: null, dlBack: null,
  rc: null, insuranceDoc: null,
  bankAccountHolder: "", bankAccountNumber: "", bankIfsc: "", upiId: "",
};

const DRAFT_KEY = (uid: string) => `tahu:driver-draft:${uid}`;

function BecomeDriver() {
  const { user, loading, roles, refreshRoles } = useAuth();
  const nav = useNavigate();
  const [d, setD] = useState<Draft>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [declaration, setDeclaration] = useState(false);
  const submitLock = useRef(false);

  const upd = useCallback(<K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((prev) => ({ ...prev, [k]: v }));
  }, []);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [loading, user, nav]);
  useEffect(() => { if (roles.includes("driver") && hydrated) nav({ to: "/driver" }); }, [roles, hydrated, nav]);

  // Hydrate draft from server + localStorage
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from("drivers_private")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data: drv } = await supabase
        .from("drivers")
        .select("vehicle_make,vehicle_model,vehicle_plate,vehicle_type")
        .eq("user_id", user.id)
        .maybeSingle();
      const local = typeof window !== "undefined" ? window.localStorage.getItem(DRAFT_KEY(user.id)) : null;
      const localDraft: Partial<Draft> = local ? safeParse(local) : {};
      if (cancelled) return;
      setD({
        ...emptyDraft,
        email: user.email ?? "",
        ...(row ? {
          fullName: row.full_name ?? "",
          email: row.email ?? user.email ?? "",
          phone: row.phone_number ?? "",
          dob: row.date_of_birth ?? "",
          gender: row.gender ?? "",
          address: row.address ?? "",
          city: row.city ?? "",
          state: row.state ?? "",
          pinCode: row.pin_code ?? "",
          emergencyContact: row.emergency_contact ?? "",
          profilePhoto: row.profile_photo_url ?? null,
          carNumber: row.car_number ?? "",
          registrationNumber: row.vehicle_registration_number ?? "",
          insuranceNumber: row.insurance_number ?? "",
          insuranceExpiry: row.insurance_expiry ?? "",
          experienceYears: row.driving_experience_years?.toString() ?? "",
          aadhaarNumber: row.aadhaar_number ?? "",
          aadhaarFront: row.aadhaar_front_url ?? null,
          aadhaarBack: row.aadhaar_back_url ?? null,
          panNumber: row.pan_number ?? "",
          pan: row.pan_url ?? null,
          license: row.driving_license ?? "",
          dlImage: row.dl_image_url ?? null,
          dlBack: row.dl_back_url ?? null,
          rc: row.rc_url ?? null,
          insuranceDoc: row.insurance_url ?? null,
          bankAccountHolder: row.bank_account_holder ?? "",
          bankAccountNumber: row.bank_account_number ?? "",
          bankIfsc: row.bank_ifsc ?? "",
          upiId: row.upi_id ?? "",
          step: Math.min(5, Math.max(1, row.onboarding_step ?? 1)) as Step,
        } : {}),
        ...(drv ? {
          make: drv.vehicle_make ?? "",
          model: drv.vehicle_model ?? "",
          carNumber: drv.vehicle_plate ?? "",
          type: drv.vehicle_type ?? "economy",
        } : {}),
        ...localDraft,
      });
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Autosave draft
  useEffect(() => {
    if (!user || !hydrated) return;
    const t = setTimeout(() => {
      try { window.localStorage.setItem(DRAFT_KEY(user.id), JSON.stringify(d)); } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(t);
  }, [d, user, hydrated]);

  const cleanPhone = d.phone.replace(/\D/g, "").slice(-10);

  const validateStep = (s: Step): string | null => {
    if (s === 1) {
      if (d.fullName.trim().length < 3) return "Enter your full name (min 3 characters)";
      if (!/^[a-zA-Z\s.'-]+$/.test(d.fullName.trim())) return "Name should contain letters only";
      if (!/^\S+@\S+\.\S+$/.test(d.email)) return "Enter a valid email";
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) return "Enter a valid 10-digit Indian mobile number";
      if (!d.dob) return "Date of birth is required";
      if (!d.gender) return "Select gender";
      if (d.address.trim().length < 8) return "Enter your full address";
      if (d.city.trim().length < 2) return "Enter city";
      if (d.state.trim().length < 2) return "Enter state";
      if (!/^\d{6}$/.test(d.pinCode)) return "PIN code must be 6 digits";
      if (!/^\d{10}$/.test(d.emergencyContact.replace(/\D/g, ""))) return "Emergency contact must be 10 digits";
    }
    if (s === 2) {
      if (!d.profilePhoto) return "Upload a profile photo";
      if (!d.carNumber.trim()) return "Enter your vehicle number";
      if (!d.make.trim() || !d.model.trim()) return "Enter vehicle make and model";
      if (!d.registrationNumber.trim()) return "Enter vehicle registration number";
      if (!d.insuranceNumber.trim()) return "Enter insurance policy number";
      if (!d.insuranceExpiry) return "Enter insurance expiry date";
      if (!d.experienceYears || Number(d.experienceYears) < 0) return "Enter driving experience";
    }
    if (s === 3) {
      if (!/^\d{12}$/.test(d.aadhaarNumber.replace(/\s/g, ""))) return "Aadhaar must be 12 digits";
      if (!d.aadhaarFront || !d.aadhaarBack) return "Upload both sides of Aadhaar";
      if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(d.panNumber.toUpperCase())) return "Enter a valid PAN number";
      if (!d.pan) return "Upload PAN card image";
      if (!d.license.trim()) return "Enter your driving licence number";
      if (!d.dlImage || !d.dlBack) return "Upload both sides of driving licence";
      if (!d.rc) return "Upload vehicle registration certificate";
      if (!d.insuranceDoc) return "Upload insurance document";
    }
    if (s === 4) {
      if (d.bankAccountHolder.trim().length < 3) return "Enter account holder name";
      if (!/^\d{9,18}$/.test(d.bankAccountNumber)) return "Account number must be 9–18 digits";
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(d.bankIfsc.toUpperCase())) return "Enter a valid IFSC code";
      if (d.upiId && !/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(d.upiId)) return "Enter a valid UPI ID";
    }
    return null;
  };

  const completionPct = useMemo(() => {
    let done = 0; const total = 4;
    for (const s of [1,2,3,4] as Step[]) if (!validateStep(s)) done++;
    return Math.round((done / total) * 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  const persistProgress = async (nextStep: Step) => {
    if (!user) return;
    await supabase.from("drivers_private").upsert({
      user_id: user.id,
      full_name: d.fullName || null,
      email: d.email || null,
      phone_number: cleanPhone || null,
      date_of_birth: d.dob || null,
      gender: d.gender || null,
      address: d.address || null,
      city: d.city || null,
      state: d.state || null,
      pin_code: d.pinCode || null,
      emergency_contact: d.emergencyContact || null,
      car_number: d.carNumber || null,
      profile_photo_url: d.profilePhoto,
      vehicle_registration_number: d.registrationNumber || null,
      insurance_number: d.insuranceNumber || null,
      insurance_expiry: d.insuranceExpiry || null,
      driving_experience_years: d.experienceYears ? Number(d.experienceYears) : null,
      aadhaar_number: d.aadhaarNumber ? d.aadhaarNumber.replace(/\s/g, "") : null,
      aadhaar_front_url: d.aadhaarFront,
      aadhaar_back_url: d.aadhaarBack,
      pan_number: d.panNumber ? d.panNumber.toUpperCase() : null,
      pan_url: d.pan,
      driving_license: d.license || null,
      dl_image_url: d.dlImage,
      dl_back_url: d.dlBack,
      rc_url: d.rc,
      insurance_url: d.insuranceDoc,
      bank_account_holder: d.bankAccountHolder || null,
      bank_account_number: d.bankAccountNumber || null,
      bank_ifsc: d.bankIfsc ? d.bankIfsc.toUpperCase() : null,
      upi_id: d.upiId || null,
      onboarding_step: nextStep,
      profile_completion_percent: completionPct,
      verification_status: "pending",
    });
  };

  const next = async () => {
    const err = validateStep(d.step);
    if (err) return toast.error(err);
    const nextStep = Math.min(5, d.step + 1) as Step;
    upd("step", nextStep);
    try { await persistProgress(nextStep); } catch { /* non-blocking */ }
  };
  const prev = () => upd("step", Math.max(1, d.step - 1) as Step);

  const onSubmit = async () => {
    if (!user || submitLock.current) return;
    if (!declaration) return toast.error("Please confirm the declaration");
    for (const s of [1, 2, 3, 4] as Step[]) {
      const err = validateStep(s);
      if (err) { upd("step", s); return toast.error(err); }
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      setPhase("Saving vehicle details…");
      const { data: inserted, error: e1 } = await supabase.from("drivers").upsert({
        user_id: user.id,
        vehicle_make: d.make,
        vehicle_model: d.model,
        vehicle_plate: d.carNumber,
        vehicle_type: d.type,
        is_approved: false,
      }, { onConflict: "user_id" }).select("id").maybeSingle();
      if (e1) throw new Error(e1.message);

      setPhase("Saving your profile…");
      const { error: ePriv } = await supabase.from("drivers_private").upsert({
        user_id: user.id,
        full_name: d.fullName,
        email: d.email,
        phone_number: cleanPhone,
        car_number: d.carNumber,
        driving_license: d.license,
        profile_photo_url: d.profilePhoto,
        aadhaar_number: d.aadhaarNumber.replace(/\s/g, ""),
        aadhaar_front_url: d.aadhaarFront,
        aadhaar_back_url: d.aadhaarBack,
        pan_number: d.panNumber.toUpperCase(),
        pan_url: d.pan,
        dl_image_url: d.dlImage,
        dl_back_url: d.dlBack,
        rc_url: d.rc,
        insurance_url: d.insuranceDoc,
        gender: d.gender,
        date_of_birth: d.dob,
        address: d.address,
        city: d.city,
        state: d.state,
        pin_code: d.pinCode,
        emergency_contact: d.emergencyContact,
        vehicle_registration_number: d.registrationNumber,
        insurance_number: d.insuranceNumber,
        insurance_expiry: d.insuranceExpiry,
        driving_experience_years: d.experienceYears ? Number(d.experienceYears) : null,
        bank_account_holder: d.bankAccountHolder,
        bank_account_number: d.bankAccountNumber,
        bank_ifsc: d.bankIfsc.toUpperCase(),
        upi_id: d.upiId,
        verification_status: "pending",
        onboarding_step: 5,
        onboarding_completed: true,
        profile_completion_percent: 100,
      });
      if (ePriv) throw new Error(ePriv.message);

      setPhase("Granting driver access…");
      const { error: e2 } = await supabase.from("user_roles").insert({ user_id: user.id, role: "driver" });
      if (e2 && !e2.message.toLowerCase().includes("duplicate")) throw new Error(e2.message);

      setPhase("Backing up to Google Sheet…");
      try {
        const urls = await Promise.all([
          getSignedDriverUrl(d.profilePhoto),
          getSignedDriverUrl(d.aadhaarFront),
          getSignedDriverUrl(d.aadhaarBack),
          getSignedDriverUrl(d.pan),
          getSignedDriverUrl(d.dlImage),
          getSignedDriverUrl(d.dlBack),
          getSignedDriverUrl(d.rc),
          getSignedDriverUrl(d.insuranceDoc),
        ]);
        const res = await syncDriverToSheet({
          data: {
            application_id: inserted?.id ?? "",
            driver_name: d.fullName, phone: cleanPhone, email: d.email, dob: d.dob,
            gender: d.gender, emergency_contact: d.emergencyContact,
            address: d.address, city: d.city, state: d.state, pin_code: d.pinCode,
            vehicle_plate: d.carNumber, vehicle_class: d.type, make: d.make, model: d.model,
            vehicle_registration_number: d.registrationNumber,
            insurance_number: d.insuranceNumber, insurance_expiry: d.insuranceExpiry,
            driving_experience_years: d.experienceYears || "0",
            license_number: d.license,
            aadhaar_number: d.aadhaarNumber.replace(/\s/g, ""),
            pan_number: d.panNumber.toUpperCase(),
            bank_account_holder: d.bankAccountHolder,
            bank_account_number: d.bankAccountNumber,
            bank_ifsc: d.bankIfsc.toUpperCase(),
            upi_id: d.upiId,
            profile_photo_url: urls[0] ?? "",
            aadhaar_front_url: urls[1] ?? "",
            aadhaar_back_url: urls[2] ?? "",
            pan_url: urls[3] ?? "",
            dl_url: urls[4] ?? "",
            dl_back_url: urls[5] ?? "",
            rc_url: urls[6] ?? "",
            insurance_url: urls[7] ?? "",
            onboarding_step: "5",
            status: "pending_admin_review",
          },
        });
        if (res?.synced) {
          await supabase.from("drivers_private").update({
            backup_sheet_synced_at: new Date().toISOString(),
          }).eq("user_id", user.id);
        }
      } catch (err) {
        console.warn("[become-driver] sheet backup failed", err);
      }

      setPhase("Finishing up…");
      await refreshRoles();
      try { window.localStorage.removeItem(DRAFT_KEY(user.id)); } catch { /* ignore */ }
      toast.success("Application submitted — welcome to Tahu cab's!");
      nav({ to: "/driver" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
      submitLock.current = false;
      setPhase("");
    }
  };

  const steps = [
    { n: 1 as Step, label: "Personal", icon: User },
    { n: 2 as Step, label: "Vehicle", icon: FileImage },
    { n: 3 as Step, label: "Documents", icon: ShieldCheck },
    { n: 4 as Step, label: "Payouts", icon: Banknote },
    { n: 5 as Step, label: "Review", icon: CheckCircle2 },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">Drive with Tahu cab's</h1>
          <p className="mt-1 text-sm text-muted-foreground">A few quick steps to become a verified driver.</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-accent transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{completionPct}%</span>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-5 gap-2">
          {steps.map((s) => {
            const active = d.step === s.n;
            const done = d.step > s.n;
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
          {d.step === 1 && (
            <Section title="Personal information" subtitle="How you appear to riders and our team.">
              <Field label="Full legal name">
                <Input required value={d.fullName} onChange={(e)=>upd("fullName", e.target.value)} placeholder="Rajesh Kumar" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email"><Input type="email" required value={d.email} onChange={(e)=>upd("email", e.target.value)} /></Field>
                <Field label="Mobile number">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 place-items-center rounded-md border border-input bg-muted px-3 text-sm">+91</span>
                    <Input required inputMode="numeric" maxLength={10} placeholder="9876543210" value={d.phone} onChange={(e)=>upd("phone", e.target.value)} />
                  </div>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date of birth"><Input type="date" required value={d.dob} onChange={(e)=>upd("dob", e.target.value)} /></Field>
                <Field label="Gender">
                  <select value={d.gender} onChange={(e)=>upd("gender", e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
              </div>
              <Field label="Residential address">
                <Textarea required value={d.address} onChange={(e)=>upd("address", e.target.value)} placeholder="House, street, area" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="City"><Input required value={d.city} onChange={(e)=>upd("city", e.target.value)} /></Field>
                <Field label="State"><Input required value={d.state} onChange={(e)=>upd("state", e.target.value)} /></Field>
                <Field label="PIN code"><Input required inputMode="numeric" maxLength={6} value={d.pinCode} onChange={(e)=>upd("pinCode", e.target.value.replace(/\D/g,""))} /></Field>
              </div>
              <Field label="Emergency contact (10 digits)">
                <Input required inputMode="numeric" maxLength={10} value={d.emergencyContact} onChange={(e)=>upd("emergencyContact", e.target.value.replace(/\D/g,""))} />
              </Field>
            </Section>
          )}

          {d.step === 2 && (
            <Section title="Profile photo & vehicle" subtitle="Riders will see your photo when you accept a trip.">
              <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
                <div className="mx-auto w-full max-w-[200px]">
                  <FileUploader kind="profile" userId={user.id} label="Profile photo" value={d.profilePhoto} onChange={(v)=>upd("profilePhoto", v)} aspect="square" hint="Max 5MB" />
                </div>
                <div className="space-y-4">
                  <Field label="Vehicle number / plate">
                    <Input required value={d.carNumber} onChange={(e)=>upd("carNumber", e.target.value.toUpperCase())} placeholder="DL01AB1234" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Make"><Input required value={d.make} onChange={(e)=>upd("make", e.target.value)} placeholder="Maruti" /></Field>
                    <Field label="Model"><Input required value={d.model} onChange={(e)=>upd("model", e.target.value)} placeholder="Dzire" /></Field>
                  </div>
                  <Field label="Vehicle class">
                    <select value={d.type} onChange={(e)=>upd("type", e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                      <option value="economy">Economy (TahuGo)</option>
                      <option value="premium">Premium (TahuPrime)</option>
                      <option value="bike">Bike (TahuMoto)</option>
                      <option value="suv">SUV (TahuXL)</option>
                    </select>
                  </Field>
                  <Field label="Registration certificate number">
                    <Input required value={d.registrationNumber} onChange={(e)=>upd("registrationNumber", e.target.value.toUpperCase())} placeholder="RC number" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Insurance policy number">
                      <Input required value={d.insuranceNumber} onChange={(e)=>upd("insuranceNumber", e.target.value)} />
                    </Field>
                    <Field label="Insurance expiry">
                      <Input type="date" required value={d.insuranceExpiry} onChange={(e)=>upd("insuranceExpiry", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Driving experience (years)">
                    <Input type="number" min={0} max={60} required value={d.experienceYears} onChange={(e)=>upd("experienceYears", e.target.value)} />
                  </Field>
                </div>
              </div>
            </Section>
          )}

          {d.step === 3 && (
            <Section title="Verification documents" subtitle="Visible only to our verification team.">
              <div className="space-y-5">
                <DocBlock title="Aadhaar card">
                  <Field label="Aadhaar number (12 digits)">
                    <Input required inputMode="numeric" maxLength={12} value={d.aadhaarNumber} onChange={(e)=>upd("aadhaarNumber", e.target.value.replace(/\D/g,""))} placeholder="1234 5678 9012" />
                  </Field>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <FileUploader kind="aadhaar_front" userId={user.id} label="Aadhaar — Front" value={d.aadhaarFront} onChange={(v)=>upd("aadhaarFront", v)} hint="Max 10MB" />
                    <FileUploader kind="aadhaar_back" userId={user.id} label="Aadhaar — Back" value={d.aadhaarBack} onChange={(v)=>upd("aadhaarBack", v)} hint="Max 10MB" />
                  </div>
                </DocBlock>

                <DocBlock title="PAN card">
                  <Field label="PAN number">
                    <Input required maxLength={10} value={d.panNumber} onChange={(e)=>upd("panNumber", e.target.value.toUpperCase())} placeholder="ABCDE1234F" />
                  </Field>
                  <div className="mt-4">
                    <FileUploader kind="pan" userId={user.id} label="PAN card image" value={d.pan} onChange={(v)=>upd("pan", v)} hint="Max 10MB" />
                  </div>
                </DocBlock>

                <DocBlock title="Driving licence">
                  <Field label="Licence number">
                    <Input required value={d.license} onChange={(e)=>upd("license", e.target.value.toUpperCase())} placeholder="DL-0420110149646" />
                  </Field>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <FileUploader kind="dl" userId={user.id} label="Licence — Front" value={d.dlImage} onChange={(v)=>upd("dlImage", v)} hint="Max 10MB" />
                    <FileUploader kind="dl_back" userId={user.id} label="Licence — Back" value={d.dlBack} onChange={(v)=>upd("dlBack", v)} hint="Max 10MB" />
                  </div>
                </DocBlock>

                <DocBlock title="Vehicle documents">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FileUploader kind="rc" userId={user.id} label="Registration certificate (RC)" value={d.rc} onChange={(v)=>upd("rc", v)} hint="Max 10MB" />
                    <FileUploader kind="insurance" userId={user.id} label="Insurance certificate" value={d.insuranceDoc} onChange={(v)=>upd("insuranceDoc", v)} hint="Max 10MB" />
                  </div>
                </DocBlock>
              </div>
            </Section>
          )}

          {d.step === 4 && (
            <Section title="Payout details" subtitle="Where you'd like to receive your ride earnings.">
              <Field label="Account holder name">
                <Input required value={d.bankAccountHolder} onChange={(e)=>upd("bankAccountHolder", e.target.value)} placeholder="As per bank records" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Account number">
                  <Input required inputMode="numeric" maxLength={18} value={d.bankAccountNumber} onChange={(e)=>upd("bankAccountNumber", e.target.value.replace(/\D/g,""))} />
                </Field>
                <Field label="IFSC code">
                  <Input required maxLength={11} value={d.bankIfsc} onChange={(e)=>upd("bankIfsc", e.target.value.toUpperCase())} placeholder="HDFC0001234" />
                </Field>
              </div>
              <Field label="UPI ID (optional, for faster payouts)">
                <Input value={d.upiId} onChange={(e)=>upd("upiId", e.target.value)} placeholder="name@bank" />
              </Field>
            </Section>
          )}

          {d.step === 5 && (
            <Section title="Review & submit" subtitle="Confirm your details before submission.">
              <ReviewRow label="Name" value={d.fullName} />
              <ReviewRow label="Mobile" value={`+91 ${cleanPhone}`} />
              <ReviewRow label="Email" value={d.email} />
              <ReviewRow label="Address" value={`${d.address}, ${d.city}, ${d.state} - ${d.pinCode}`} />
              <ReviewRow label="Vehicle" value={`${d.make} ${d.model} · ${d.carNumber} · ${d.type}`} />
              <ReviewRow label="Insurance" value={`${d.insuranceNumber} (expires ${d.insuranceExpiry})`} />
              <ReviewRow label="Aadhaar" value={d.aadhaarNumber.replace(/(\d{4})(?=\d)/g, "$1 ")} />
              <ReviewRow label="PAN" value={d.panNumber.toUpperCase()} />
              <ReviewRow label="Licence" value={d.license} />
              <ReviewRow label="Bank" value={`${d.bankAccountHolder} · ${d.bankIfsc.toUpperCase()}`} />
              {d.upiId && <ReviewRow label="UPI" value={d.upiId} />}

              <label className="mt-4 flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 cursor-pointer">
                <Checkbox checked={declaration} onCheckedChange={(v) => setDeclaration(v === true)} className="mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  I confirm the uploaded documents and information belong to me and agree to the Terms & Conditions and Privacy Policy.
                </span>
              </label>

              {submitting && (
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> {phase || "Submitting…"}
                </div>
              )}
            </Section>
          )}

          <div className="flex items-center justify-between border-t border-border/60 pt-5">
            <Button type="button" variant="outline" onClick={prev} disabled={d.step === 1 || submitting}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            {d.step < 5 ? (
              <Button type="button" onClick={next} className="gradient-accent text-accent-foreground">
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={submitting || !declaration}
                onClick={onSubmit}
                className="gradient-accent text-accent-foreground"
              >
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : "Submit application"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function safeParse(s: string): Partial<Draft> {
  try { return JSON.parse(s); } catch { return {}; }
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

function DocBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <p className="mb-3 text-sm font-semibold">{title}</p>
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/40 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}
