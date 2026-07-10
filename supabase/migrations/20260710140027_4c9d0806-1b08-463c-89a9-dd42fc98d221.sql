
-- Allow users to self-apply as drivers (approval still gated by drivers.is_approved / drivers_private.verification_status)
CREATE POLICY "users can self-assign driver role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'driver'::public.app_role);

-- Update guard trigger to also permit self-assignment of driver role
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
  IF NEW.role = 'driver'::public.app_role AND auth.uid() = NEW.user_id THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can assign role %', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;
