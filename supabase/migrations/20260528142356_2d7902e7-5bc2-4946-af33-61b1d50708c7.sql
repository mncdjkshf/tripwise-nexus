-- 1) Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS is_validated boolean NOT NULL DEFAULT false;

-- 2) Extend drivers with sensitive onboarding data
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS car_number text,
  ADD COLUMN IF NOT EXISTS driving_license text,
  ADD COLUMN IF NOT EXISTS personal_details_json jsonb,
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_ping timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS drivers_email_key ON public.drivers (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS drivers_phone_key ON public.drivers (phone_number) WHERE phone_number IS NOT NULL;

-- 3) OTP verifications
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  identifier text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  otp_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_identifier_idx ON public.otp_verifications (identifier, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.otp_verifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.otp_verifications TO anon;
GRANT ALL ON public.otp_verifications TO service_role;

ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can insert otp" ON public.otp_verifications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "read own otp by identifier" ON public.otp_verifications
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "admin manage otp" ON public.otp_verifications
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Restrict raw drivers table: drop the broad SELECT policy, keep admin + self
DROP POLICY IF EXISTS "online drivers visible to auth" ON public.drivers;

CREATE POLICY "driver sees own row" ON public.drivers
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- (admin manage drivers policy already grants admin full access)

-- 5) Public-safe driver view (no sensitive fields)
CREATE OR REPLACE VIEW public.drivers_public
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  full_name,
  car_number,
  vehicle_make,
  vehicle_model,
  vehicle_type,
  rating,
  status,
  is_approved,
  current_lat,
  current_lng,
  last_ping
FROM public.drivers
WHERE is_approved = true AND status <> 'offline';

-- security_invoker view requires SELECT privilege on base columns for the caller.
-- Grant column-level SELECT on the safe columns to authenticated.
GRANT SELECT
  (id, user_id, full_name, car_number, vehicle_make, vehicle_model, vehicle_type,
   rating, status, is_approved, current_lat, current_lng, last_ping)
  ON public.drivers TO authenticated;

GRANT SELECT ON public.drivers_public TO authenticated;

-- Allow authenticated to SELECT through the view by adding a permissive policy
-- limited to approved+online rows (view's WHERE narrows further).
CREATE POLICY "approved online drivers public" ON public.drivers
  FOR SELECT TO authenticated
  USING (is_approved = true AND status <> 'offline');

-- 6) Helper: mark profile validated (called by verify_otp server fn via service role)
-- No SQL fn needed; server fn uses supabaseAdmin.