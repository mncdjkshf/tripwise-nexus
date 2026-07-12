import { supabase } from "@/integrations/supabase/client";

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_DOC = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export type DocKind =
  | "profile"
  | "aadhaar_front"
  | "aadhaar_back"
  | "pan"
  | "dl"
  | "dl_back"
  | "rc"
  | "insurance";

const BUCKET: Record<DocKind, "driver-avatars" | "driver-documents"> = {
  profile: "driver-avatars",
  aadhaar_front: "driver-documents",
  aadhaar_back: "driver-documents",
  pan: "driver-documents",
  dl: "driver-documents",
  dl_back: "driver-documents",
  rc: "driver-documents",
  insurance: "driver-documents",
};

export async function uploadDriverFile(kind: DocKind, userId: string, file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("File must be JPG, PNG or WEBP");
  const max = kind === "profile" ? MAX_IMAGE : MAX_DOC;
  if (file.size > max) throw new Error(`File must be under ${Math.round(max / 1024 / 1024)}MB`);

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const bucket = BUCKET[kind];
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
  return `${bucket}/${path}`;
}

export async function getSignedDriverUrl(fullPath: string | null | undefined): Promise<string | null> {
  if (!fullPath) return null;
  const [bucket, ...rest] = fullPath.split("/");
  const path = rest.join("/");
  if (!bucket || !path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
