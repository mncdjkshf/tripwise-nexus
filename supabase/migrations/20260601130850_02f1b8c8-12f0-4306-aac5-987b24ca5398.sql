
DROP TABLE IF EXISTS public.otp_verifications;

ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'no_drivers_available';

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS current_offer_driver_id uuid,
  ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_driver_ids uuid[] NOT NULL DEFAULT '{}';

CREATE TABLE public.driver_locations (
  driver_id uuid PRIMARY KEY,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading double precision,
  speed double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.driver_locations TO authenticated;
GRANT ALL ON public.driver_locations TO service_role;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver upserts own location" ON public.driver_locations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "driver updates own location" ON public.driver_locations FOR UPDATE TO authenticated
  USING (auth.uid() = driver_id);
CREATE POLICY "driver sees own location" ON public.driver_locations FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);
CREATE POLICY "rider sees driver location for own active ride" ON public.driver_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides r WHERE r.driver_id = driver_locations.driver_id AND r.rider_id = auth.uid() AND r.status IN ('accepted','arriving','in_progress')));
CREATE POLICY "admin manage driver_locations" ON public.driver_locations FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.ride_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired')),
  offered_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  expires_at timestamptz NOT NULL,
  UNIQUE (ride_id, driver_id)
);
CREATE INDEX idx_ride_offers_driver_pending ON public.ride_offers(driver_id, status);
CREATE INDEX idx_ride_offers_ride ON public.ride_offers(ride_id);
GRANT SELECT, INSERT, UPDATE ON public.ride_offers TO authenticated;
GRANT ALL ON public.ride_offers TO service_role;
ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver sees own offers" ON public.ride_offers FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);
CREATE POLICY "rider sees offers for own ride" ON public.ride_offers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_offers.ride_id AND r.rider_id = auth.uid()));
CREATE POLICY "admin manage ride_offers" ON public.ride_offers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.ride_otp (
  ride_id uuid PRIMARY KEY REFERENCES public.rides(id) ON DELETE CASCADE,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.ride_otp TO authenticated;
GRANT ALL ON public.ride_otp TO service_role;
ALTER TABLE public.ride_otp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rider sees own ride otp" ON public.ride_otp FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_otp.ride_id AND r.rider_id = auth.uid()));
CREATE POLICY "driver sees ride otp after arrived" ON public.ride_otp FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_otp.ride_id AND r.driver_id = auth.uid() AND r.arrived_at IS NOT NULL));
CREATE POLICY "admin manage ride_otp" ON public.ride_otp FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_drivers_status_vehicle ON public.drivers(status, vehicle_type) WHERE is_approved = true;
CREATE INDEX IF NOT EXISTS idx_drivers_location ON public.drivers(current_lat, current_lng);

ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_otp;

ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;
ALTER TABLE public.ride_offers REPLICA IDENTITY FULL;
ALTER TABLE public.ride_otp REPLICA IDENTITY FULL;
ALTER TABLE public.rides REPLICA IDENTITY FULL;
