import { useEffect, useRef, useState } from "react";
import { Upload, X, Camera, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadDriverFile, getSignedDriverUrl, type DocKind } from "@/lib/driver-storage";

type Props = {
  kind: DocKind;
  userId: string;
  label: string;
  hint?: string;
  value: string | null;
  onChange: (path: string | null) => void;
  aspect?: "square" | "card";
};

export function FileUploader({ kind, userId, label, hint, value, onChange, aspect = "card" }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (value) getSignedDriverUrl(value).then((u) => { if (!cancelled) setPreview(u); });
    else setPreview(null);
    return () => { cancelled = true; };
  }, [value]);

  const handle = async (file: File | undefined | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadDriverFile(kind, userId, file);
      onChange(path);
      toast.success(`${label} uploaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files?.[0]); }}
        className={`relative overflow-hidden rounded-xl border-2 border-dashed border-border/70 bg-muted/30 transition-colors hover:border-accent/60 ${
          aspect === "square" ? "aspect-square" : "aspect-[16/10]"
        }`}
      >
        {preview ? (
          <>
            <img src={preview} alt={label} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-foreground shadow hover:bg-background"
              aria-label="Remove"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center p-4 text-center">
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="space-y-2">
                <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Drag & drop or choose an image</p>
                <div className="flex justify-center gap-2 pt-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
                    <ImageIcon className="h-3.5 w-3.5" /> Gallery
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => camRef.current?.click()}>
                    <Camera className="h-3.5 w-3.5" /> Camera
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      {preview && (
        <button type="button" onClick={() => inputRef.current?.click()} className="text-xs text-accent hover:underline">
          Replace image
        </button>
      )}
    </div>
  );
}
