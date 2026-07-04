import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle, ArrowLeft } from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/file-uploader";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DocKind } from "@/lib/driver-storage";

export const Route = createFileRoute("/driver-documents")({
  head: () => ({ meta: [{ title: "My documents — Tahu cab's" }] }),
  component: DriverDocuments,
});

type PrivateRow = {
  profile_photo_url: string | null;
  aadhaar_front_url: string | null;
  aadhaar_back_url: string | null;
  pan_url: string | null;
  dl_image_url: string | null;
  verification_status: string;
};

function DriverDocuments() {
  const { user, loading, roles } = useAuth();
  const nav = useNavigate();
  const [row, setRow] = useState<PrivateRow | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [loading, user, nav]);
  useEffect(() => { if (!loading && user && !roles.includes("driver")) nav({ to: "/become-driver" }); }, [loading, user, roles, nav]);

  useEffect(() => {
    if (!user) return;
    supabase.from("drivers_private")
      .select("profile_photo_url,aadhaar_front_url,aadhaar_back_url,pan_url,dl_image_url,verification_status")
      .eq("user_id", user.id).maybeSingle().then(({ data }) => setRow(data as PrivateRow | null));
  }, [user]);

  const update = async (col: keyof PrivateRow, value: string | null) => {
    if (!user) return;
    setRow((r) => (r ? { ...r, [col]: value } as PrivateRow : r));
    const patch: Record<string, string | null> = { [col]: value };
    const { error } = await supabase.from("drivers_private").update(patch as never).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Document updated");
  };

  if (!user || !row) return <div className="min-h-screen"><NavBar /><div className="p-10 text-muted-foreground">Loading…</div></div>;

  const docs: { key: keyof PrivateRow; kind: DocKind; label: string }[] = [
    { key: "profile_photo_url", kind: "profile", label: "Profile photo" },
    { key: "aadhaar_front_url", kind: "aadhaar_front", label: "Aadhaar — Front" },
    { key: "aadhaar_back_url", kind: "aadhaar_back", label: "Aadhaar — Back" },
    { key: "pan_url", kind: "pan", label: "PAN card" },
    { key: "dl_image_url", kind: "dl", label: "Driving licence" },
  ];

  const status = row.verification_status;
  const StatusIcon = status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : Clock;
  const statusColor = status === "approved" ? "text-green-600" : status === "rejected" ? "text-destructive" : "text-amber-600";
  const statusLabel = status === "approved" ? "Verified" : status === "rejected" ? "Rejected — please re-upload" : "Pending verification";

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/driver"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link></Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">My documents</h1>
            <p className="text-sm text-muted-foreground">Manage the documents used to verify your account.</p>
          </div>
          <div className={`flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 text-sm ${statusColor}`}>
            <StatusIcon className="h-4 w-4" /> {statusLabel}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {docs.map((d) => (
            <div key={d.key} className="rounded-2xl border border-border/60 bg-card p-4">
              <FileUploader
                kind={d.kind}
                userId={user.id}
                label={d.label}
                value={row[d.key]}
                onChange={(v) => update(d.col, v)}
                aspect={d.kind === "profile" ? "square" : "card"}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
