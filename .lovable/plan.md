
# Tahu Cabs × Uber Clone — Phased Merge Plan

The Uber clone backend (Mongo/Express/Socket.IO) is discarded — your stack is TanStack Start + Supabase. Only the React UI components are reusable, and they'll be ported in Phase 3. This plan covers **Phase 1 only**; Phases 2 and 3 follow after Phase 1 ships.

---

## Phase 1 (this round) — Backend foundation

Goal: every realtime/dispatch/OTP/GPS feature has a working server contract before any UI is touched.

### 1. Database migration

New tables (Supabase, RLS + GRANTs):

- **`driver_locations`** — `driver_id` (PK, FK→drivers.user_id), `lat`, `lng`, `heading`, `speed`, `updated_at`. One row per driver, upserted every 3–5s by driver's `watchPosition`. Realtime publication enabled.
- **`ride_offers`** — `id`, `ride_id` (FK→rides), `driver_id`, `status` (`pending`/`accepted`/`rejected`/`expired`), `offered_at`, `responded_at`, `expires_at`. Unique on `(ride_id, driver_id)`. Powers sequential dispatch + `rejected_driver_ids` history.
- **`ride_otp`** — `ride_id` (PK, FK→rides), `code` (4-digit text), `created_at`, `expires_at`, `consumed_at`. Generated when driver arrives, consumed when driver enters code.
- **Add columns to `rides`**: `current_offer_driver_id`, `offer_expires_at`, `arrived_at`.

Drop unused `otp_verifications` table (no longer used after earlier OTP removal).

RLS:
- `driver_locations`: driver can upsert own row; riders can SELECT only the row of their accepted-ride driver.
- `ride_offers`: driver sees own pending offers; rider sees offers for own ride.
- `ride_otp`: rider sees own ride's code; driver sees code only after `arrived_at`.

### 2. Server functions (`src/lib/`)

All as `createServerFn` with `requireSupabaseAuth`:

- **`dispatch.functions.ts`**
  - `requestRideWithDispatch({ rideId })` — finds nearest online approved driver (Haversine on `driver_locations`, filtered by `vehicle_type`, excluding past rejecters), creates a `ride_offers` row with 15s expiry, sets `rides.current_offer_driver_id`.
  - `respondToOffer({ offerId, accept })` — atomic: if accept, locks ride (`driver_id = me`, status=`accepted`), expires all other offers for that ride; if reject, marks offer rejected and triggers next dispatch.
  - `expireAndAdvanceOffer({ rideId })` — called by client timer or cron; marks current offer expired and offers to next driver. Max ~5 attempts, then ride goes `no_drivers_available`.
- **`otp.functions.ts`** (new, replaces the deleted one with a different purpose)
  - `markArrivedAndGenerateOtp({ rideId })` — driver-only, sets `arrived_at`, generates 4-digit code, inserts `ride_otp`, returns nothing (code only readable by rider via RLS).
  - `verifyRideOtp({ rideId, code })` — driver-only, single-use, 10-min expiry, sets ride status `in_progress`, `started_at`.
- **`location.functions.ts`**
  - `pingDriverLocation({ lat, lng, heading?, speed? })` — driver-only upsert into `driver_locations`. Throttled server-side to 1/sec.

### 3. Realtime channels

Enable Supabase Realtime publication on `driver_locations`, `ride_offers`, `rides`, `ride_otp`. The frontend will subscribe in Phase 2/3 — no UI work this phase.

### 4. Cleanup

- Delete legacy `otp_verifications` table + any remaining references.
- Add `vehicle_type` index on `drivers` and `(status, current_lat, current_lng)` for dispatch query performance.

### 5. Verification

- Hit each server fn via `stack_modern--invoke-server-function` with a seeded test driver/rider.
- Confirm realtime publication via `supabase--read_query` on `pg_publication_tables`.

---

## Phase 2 (next round) — Driver dashboard + live GPS

- Port `CaptainHome` + `CaptainDetails` → `DriverDashboard` (TSX, Tahu tokens).
- Driver online toggle → starts `watchPosition` → calls `pingDriverLocation`.
- Realtime subscription on `ride_offers` where `driver_id = me AND status='pending'` → shows `RidePopUp` (ported).
- Accept/Reject buttons call `respondToOffer`.
- Active-trip view shows pickup route via existing `computeRoute` server fn.

## Phase 3 (final round) — Rider ride flow UI

- Port `LookingForDriver`, `WaitingForDriver`, `ConfirmRide`, `Riding` components to TSX with Tahu tokens.
- Rider sees driver's live marker (subscription to `driver_locations` for assigned driver).
- Rider sees OTP code after driver marks arrived.
- Privacy gates: hide driver GPS until ride accepted; stop subscription on `completed`/`cancelled`.

---

## Explicit non-goals

- ❌ No `apps/rider-app`, `apps/driver-dashboard`, `apps/admin-dashboard` split — TanStack Start is a single app; we organize by `src/routes/` + feature folders.
- ❌ No admin dashboard expansion (existing `/admin` stub stays).
- ❌ No port of Uber Node/Mongo/Express/Socket.IO backend — replaced entirely by Supabase + server functions.
- ❌ No Uber visual style — re-skin only the components that fill genuine gaps, using your existing Tahu design tokens.

---

**Phase 1 deliverable**: migration + 6 server functions + realtime publications, all verified end-to-end via direct invocation. No UI changes this round.
