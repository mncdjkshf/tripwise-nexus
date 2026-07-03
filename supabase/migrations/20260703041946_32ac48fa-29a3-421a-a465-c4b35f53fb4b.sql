
-- ============================================================
-- Fix 1: SUPA_authenticated_security_definer_function_executable
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- ============================================================
-- Fix 2: drivers_realtime_sensitive_data_leak
-- ============================================================

-- Drop the existing helper view (references PII columns; recreated below)
DROP VIEW IF EXISTS public.drivers_public;

CREATE TABLE public.drivers_private (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone_number text,
  car_number text,
  driving_license text,
  personal_details_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers_private TO authenticated;
GRANT ALL ON public.drivers_private TO service_role;

ALTER TABLE public.drivers_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver reads own private row"
  ON public.drivers_private FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "driver inserts own private row"
  ON public.drivers_private FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "driver updates own private row"
  ON public.drivers_private FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins manage drivers_private"
  ON public.drivers_private FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_drivers_private_updated
  BEFORE UPDATE ON public.drivers_private
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.drivers_private
  (user_id, full_name, email, phone_number, car_number, driving_license, personal_details_json)
SELECT user_id, full_name, email, phone_number, car_number, driving_license, personal_details_json
FROM public.drivers
ON CONFLICT (user_id) DO NOTHING;

DROP INDEX IF EXISTS public.drivers_email_key;
DROP INDEX IF EXISTS public.drivers_phone_key;

ALTER TABLE public.drivers
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone_number,
  DROP COLUMN IF EXISTS driving_license,
  DROP COLUMN IF EXISTS personal_details_json,
  DROP COLUMN IF EXISTS full_name,
  DROP COLUMN IF EXISTS car_number;

-- Recreate the safe helper view without PII columns
CREATE VIEW public.drivers_public
WITH (security_invoker = true) AS
SELECT id, user_id, vehicle_make, vehicle_model, vehicle_type,
       rating, status, is_approved, current_lat, current_lng, last_ping
FROM public.drivers
WHERE is_approved = true AND status <> 'offline'::public.driver_status;
GRANT SELECT ON public.drivers_public TO authenticated;

-- ============================================================
-- Fix 3: otp_verifications_no_user_read_policy (ride_otp)
-- ============================================================
DROP POLICY IF EXISTS "driver sees ride otp after arrived" ON public.ride_otp;
DROP POLICY IF EXISTS "rider sees own ride otp"           ON public.ride_otp;

ALTER PUBLICATION supabase_realtime DROP TABLE public.ride_otp;

-- ============================================================
-- Fix 4: profiles_readable_by_all_authenticated
-- ============================================================
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;

CREATE POLICY "users read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_phone_registered(_phone text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE phone = _phone);
$$;
REVOKE EXECUTE ON FUNCTION public.is_phone_registered(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_phone_registered(text) TO anon, authenticated;

-- ============================================================
-- Fix 5: realtime_messages_no_channel_authorization
-- Deny broadcast/presence by default; app uses only postgres_changes.
-- ============================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny all broadcast/presence reads by default" ON realtime.messages;
CREATE POLICY "deny all broadcast/presence reads by default"
  ON realtime.messages FOR SELECT TO authenticated, anon
  USING (false);

DROP POLICY IF EXISTS "deny all broadcast/presence writes by default" ON realtime.messages;
CREATE POLICY "deny all broadcast/presence writes by default"
  ON realtime.messages FOR INSERT TO authenticated, anon
  WITH CHECK (false);

-- ============================================================
-- Fix 6: user_roles_self_insert_missing
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_user_roles_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'rider'::public.app_role THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can assign role %', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_user_roles_write() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_user_roles ON public.user_roles;
CREATE TRIGGER trg_guard_user_roles
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_roles_write();
