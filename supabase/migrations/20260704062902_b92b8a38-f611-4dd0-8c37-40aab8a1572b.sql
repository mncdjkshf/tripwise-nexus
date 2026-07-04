
-- Driver document + profile columns
ALTER TABLE public.drivers_private
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS aadhaar_number text,
  ADD COLUMN IF NOT EXISTS aadhaar_front_url text,
  ADD COLUMN IF NOT EXISTS aadhaar_back_url text,
  ADD COLUMN IF NOT EXISTS pan_number text,
  ADD COLUMN IF NOT EXISTS pan_url text,
  ADD COLUMN IF NOT EXISTS dl_image_url text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS emergency_contact text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS emergency_contact text;

-- Storage RLS: driver-avatars and driver-documents
-- Path convention: "<user_id>/<filename>"

DROP POLICY IF EXISTS "driver avatars: owner read" ON storage.objects;
DROP POLICY IF EXISTS "driver avatars: owner write" ON storage.objects;
DROP POLICY IF EXISTS "driver avatars: owner update" ON storage.objects;
DROP POLICY IF EXISTS "driver avatars: owner delete" ON storage.objects;
DROP POLICY IF EXISTS "driver avatars: admin read" ON storage.objects;
DROP POLICY IF EXISTS "driver docs: owner read" ON storage.objects;
DROP POLICY IF EXISTS "driver docs: owner write" ON storage.objects;
DROP POLICY IF EXISTS "driver docs: owner update" ON storage.objects;
DROP POLICY IF EXISTS "driver docs: owner delete" ON storage.objects;
DROP POLICY IF EXISTS "driver docs: admin read" ON storage.objects;

CREATE POLICY "driver avatars: owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'driver-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "driver avatars: owner write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'driver-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "driver avatars: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'driver-avatars' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'driver-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "driver avatars: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'driver-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "driver avatars: admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'driver-avatars' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "driver docs: owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'driver-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "driver docs: owner write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'driver-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "driver docs: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'driver-documents' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'driver-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "driver docs: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'driver-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "driver docs: admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'driver-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role));
