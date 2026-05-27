import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MapPin, Clock, Car, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function BottomNav() {
  const { user, roles } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (!user) return null;
  const isDriver = roles.includes("driver");
  const isAdmin = roles.includes("admin");

  const items = [
    { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
    { to: "/ride", label: "Ride", icon: MapPin, match: (p: string) => p.startsWith("/ride") || p.startsWith("/track") },
    { to: "/history", label: "Trips", icon: Clock, match: (p: string) => p.startsWith("/history") },
    isDriver
      ? { to: "/driver", label: "Drive", icon: Car, match: (p: string) => p.startsWith("/driver") }
      : { to: "/become-driver", label: "Drive", icon: Car, match: (p: string) => p.startsWith("/become-driver") },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Shield, match: (p: string) => p.startsWith("/admin") }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden">
      <ul
        className="mx-auto grid max-w-md px-2 py-1.5"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}
      >
        {items.map(({ to, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <li key={to}>
              <Link
                to={to as string}
                className={`flex flex-col items-center gap-0.5 py-1.5 text-[10px] ${active ? "text-accent" : "text-muted-foreground"}`}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
