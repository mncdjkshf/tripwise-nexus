import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Car, MapPin, Shield, Sparkles, Zap } from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tahu cab's — Ride in minutes, drive on your schedule" },
      { name: "description", content: "Book a ride in seconds with live tracking, transparent pricing, and modern vehicles. Or drive with Tahu cab's and earn on your own schedule." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen">
      <NavBar />

      <main>
        {/* Hero */}
        <section className="relative gradient-hero overflow-hidden">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-24 md:grid-cols-2 md:py-32">
            <div className="flex flex-col justify-center">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3 text-accent" /> Now live in your city
              </span>
              <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-7xl">
                Go anywhere.
                <br />
                <span className="bg-gradient-to-r from-accent to-success bg-clip-text text-transparent">Get there in style.</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg text-muted-foreground">
                Request a ride, hop in, and relax. Live driver tracking, transparent pricing, and a fleet that fits your vibe.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="gradient-accent text-accent-foreground shadow-elegant hover:opacity-90">
                  <Link to="/ride">
                    Book a ride <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/become-driver">Drive with Tahu cab's</Link>
                </Button>
              </div>
            </div>

            {/* Booking-card mock */}
            <div className="glass relative rounded-3xl p-6 shadow-card md:p-8">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Estimated trip</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 rounded-xl bg-secondary/60 px-4 py-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-accent" />
                  <span className="text-sm">Market Street, SF</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-secondary/60 px-4 py-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
                  <span className="text-sm">SFO Airport, Terminal 2</span>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { l: "RideX", p: "$24.50", e: "3 min" },
                  { l: "Premier", p: "$39.20", e: "5 min" },
                  { l: "XL", p: "$51.80", e: "6 min" },
                ].map((x) => (
                  <div key={x.l} className="rounded-xl border border-border/60 bg-card/60 p-3">
                    <p className="text-xs text-muted-foreground">{x.l}</p>
                    <p className="mt-1 text-sm font-semibold">{x.p}</p>
                    <p className="text-[10px] text-muted-foreground">{x.e} away</p>
                  </div>
                ))}
              </div>
              <Button asChild className="mt-5 w-full gradient-accent text-accent-foreground">
                <Link to="/ride">Confirm RideX</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-7xl px-6 py-24">
          <h2 className="text-3xl font-bold md:text-4xl">Built for the way you move.</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { i: MapPin, t: "Live tracking", d: "Watch your driver arrive in real time on the map." },
              { i: Zap, t: "Instant pricing", d: "See the fare upfront. No surprises, no haggling." },
              { i: Shield, t: "Safety first", d: "Verified drivers, in-app support, trip sharing." },
            ].map(({ i: Icon, t, d }) => (
              <div key={t} className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
                <div className="grid h-10 w-10 place-items-center rounded-xl gradient-accent">
                  <Icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Drive CTA */}
        <section className="mx-auto max-w-7xl px-6 pb-24">
          <div className="rounded-3xl border border-border/60 bg-card p-10 shadow-card md:p-16">
            <div className="grid items-center gap-8 md:grid-cols-2">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">
                  <Car className="h-3 w-3" /> Earn with Tahu cab's
                </span>
                <h2 className="mt-4 text-3xl font-bold md:text-4xl">Your car. Your hours. Your earnings.</h2>
                <p className="mt-3 text-muted-foreground">Sign up as a driver in minutes and start accepting rides.</p>
              </div>
              <div className="flex md:justify-end">
                <Button asChild size="lg" className="gradient-accent text-accent-foreground">
                  <Link to="/become-driver">Start driving <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Tahu cab's</span>
          <span>Built on Lovable</span>
        </div>
      </footer>
    </div>
  );
}
