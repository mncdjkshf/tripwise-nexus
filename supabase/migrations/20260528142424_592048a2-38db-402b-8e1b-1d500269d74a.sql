DROP POLICY IF EXISTS "anyone can insert otp" ON public.otp_verifications;
DROP POLICY IF EXISTS "read own otp by identifier" ON public.otp_verifications;

REVOKE INSERT, SELECT, UPDATE ON public.otp_verifications FROM anon, authenticated;
-- service_role retains ALL via earlier grant; server fns will use supabaseAdmin.