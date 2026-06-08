# Ride-Hailing Full Build — Phased Plan

The existing app already has: rider booking, dispatch with offers + TTL, driver dashboard (accept/reject/busy), ride-start OTP, live GPS pings, Google Maps + road-following route line, admin route, profiles, user_roles, yellow+blue theme. This plan only adds what's missing.

## Phase 1 — Cancellation, Ratings, Earnings, Animated tracking
**Migration:**
- `rides`: add `cancelled_by` (uuid), `cancellation_reason` (text), `cancelled_at` (timestamptz)
- New `ratings` table (ride_id, rater_id, ratee_id, role, stars 1-5, comment) + GRANTs + RLS
- New `ride_status_history` table (ride_id, from_status, to_status, changed_by, changed_at) + trigger on `rides` status change

**Server fns** (`src/lib/ride-lifecycle.functions.ts`):
- `cancelRide({rideId, reason})` — rider or driver, sets status='cancelled' + audit fields, frees driver
- `rateRide({rideId, stars, comment})` — rider rates driver (and reverse)
- `getDriverEarnings()` — today / week / total / trip count from completed rides

**UI:**
- Rider tracking page: "Cancel ride" button with reason dialog
- Post-ride: 5-star rating sheet
- Driver dashboard: earnings cards (Today, Week, Total, Trips)
- Rider tracking: interpolated driver marker (tween between pings, rotate by heading, car/bike SVG)

## Phase 2 — Notifications + Cancellation realtime
- New `notifications` table + RLS, realtime publication
- Toast on driver when rider cancels, toast on rider when driver cancels/arrives
- `notifyUser` server fn helper

## Phase 3 — Payments scaffold
- Migration: `payments`, `transactions`, `wallets`, `wallet_transactions` (all with GRANTs + RLS)
- `PaymentProvider` interface in `src/lib/payments/provider.ts` with Razorpay + Stripe + Cash stubs
- Secrets: ask user for `RAZORPAY_KEY_ID` / `STRIPE_SECRET_KEY` only when they're ready (placeholders until then)
- Server fns: `createPaymentIntent`, `confirmPayment`, `getWallet`, `topUpWallet` (cash path works end-to-end immediately)
- UI: payment method selector on booking screen, wallet page, post-ride payment confirmation

## Phase 4 — Auth: Google OAuth + Phone OTP
- Call `supabase--configure_social_auth` for Google (Cloud-managed, no keys needed)
- Add "Continue with Google" button to `/login` and `/register` via `lovable.auth.signInWithOAuth("google")`
- `OtpProvider` interface in `src/lib/otp/provider.ts` (Twilio/MSG91/console stubs)
- `sendPhoneOtp` / `verifyPhoneOtp` server fns + `phone_otp` table with TTL + rate limit (per phone, in-DB)
- Phone verification step in driver onboarding

## Out of scope (explicit)
- Restructuring into `src/modules/*` clean-architecture folders — incompatible with TanStack file routing
- Express-style REST endpoints — replaced by equivalent `createServerFn` RPCs
- Backend rate limiting primitive — none exists in stack; per-phone OTP limit only
- Unzipping the reference server into the repo — used as design reference only

## Technical notes
- All new tables: `GRANT` block + `ENABLE ROW LEVEL SECURITY` + policies in same migration
- Server fns use `requireSupabaseAuth`; admin client only inside `.handler()` via dynamic import
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE` for `rides`, `notifications`, `ratings`
- Animated marker: requestAnimationFrame tween, no library
- No straight-line routes — keep existing `computeRoute` Google Routes API call
