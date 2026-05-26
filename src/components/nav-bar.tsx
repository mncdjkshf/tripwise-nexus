import { Link } from "@tanstack/react-router";
import { Car, User as UserIcon, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function NavBar() {
  const { user, roles, signOut } = useAuth();
  const isDriver = roles.includes("driver");
  const isAdmin = roles.includes("admin");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg gradient-accent">
            <Car className="h-4 w-4 text-accent-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">Tahu cab's</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link to="/" className="hover:text-foreground" activeOptions={{ exact: true }}>Home</Link>
          {user && <Link to="/ride" className="hover:text-foreground">Book a ride</Link>}
          {isDriver && <Link to="/driver" className="hover:text-foreground">Drive</Link>}
          {isAdmin && <Link to="/admin" className="hover:text-foreground">Admin</Link>}
        </nav>

        <div className="flex items-center gap-2">
          {!user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="gradient-accent text-accent-foreground hover:opacity-90">
                <Link to="/register">Get started</Link>
              </Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-secondary">
                    <UserIcon className="h-3.5 w-3.5" />
                  </div>
                  <span className="hidden sm:inline max-w-[120px] truncate">{user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild><Link to="/ride">Book a ride</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/history">Ride history</Link></DropdownMenuItem>
                {isDriver && <DropdownMenuItem asChild><Link to="/driver">Driver dashboard</Link></DropdownMenuItem>}
                {!isDriver && <DropdownMenuItem asChild><Link to="/become-driver">Become a driver</Link></DropdownMenuItem>}
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5" /> Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
                  <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
