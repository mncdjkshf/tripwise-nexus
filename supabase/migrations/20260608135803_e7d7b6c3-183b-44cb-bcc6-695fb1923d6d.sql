
-- 1. Cancellation audit fields on rides
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- 2. Ratings table
CREATE TABLE IF NOT EXISTS public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('rider','driver')),
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id, rater_id)
);
GRANT SELECT, INSERT ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rater inserts own rating" ON public.ratings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = rater_id);
CREATE POLICY "participants read ratings" ON public.ratings
  FOR SELECT TO authenticated
  USING (auth.uid() = rater_id OR auth.uid() = ratee_id OR public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_ratings_ratee ON public.ratings(ratee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_ride ON public.ratings(ride_id);

-- 3. Ride status history
CREATE TABLE IF NOT EXISTS public.ride_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  from_status ride_status,
  to_status ride_status NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ride_status_history TO authenticated;
GRANT ALL ON public.ride_status_history TO service_role;
ALTER TABLE public.ride_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read status history" ON public.ride_status_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = ride_status_history.ride_id
      AND (r.rider_id = auth.uid() OR r.driver_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ));

CREATE INDEX IF NOT EXISTS idx_rsh_ride ON public.ride_status_history(ride_id);

-- 4. Trigger to auto-log status changes
CREATE OR REPLACE FUNCTION public.log_ride_status_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ride_status_history (ride_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, NEW.rider_id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.ride_status_history (ride_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, COALESCE(NEW.cancelled_by, NEW.driver_id, NEW.rider_id));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_ride_status ON public.rides;
CREATE TRIGGER trg_log_ride_status
  AFTER INSERT OR UPDATE OF status ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.log_ride_status_change();

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ratings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_status_history;
