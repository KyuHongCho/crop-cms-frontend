import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useMember } from "../auth/MemberContext";
import Logo from "../components/brand/Logo";
import FormError from "../components/FormError";
import { cn } from "@/lib/utils";
import MemberMenu from "./MemberMenu";

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring",
    isActive ? "text-foreground underline" : "text-muted-foreground hover:text-foreground",
  );

export default function AppShell() {
  const { error } = useMember();
  const { pathname } = useLocation();
  // Effect, not a scroll-restoration reset: browser Back still restores the old position.
  // Block body: some browsers' scrollTo returns a Promise, which React would call as cleanup.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <header className="sticky top-0 z-40 h-14 border-b bg-background">
        <div className="mx-auto flex h-full max-w-6xl items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Link
            to="/chat"
            aria-label="Crop CMS"
            className="rounded-lg text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <Logo className="[&>span]:max-sm:hidden" />
          </Link>
          <nav aria-label="Main" className="ml-2 flex items-center gap-1 sm:ml-4">
            <NavLink to="/chat" className={navClass}>Ask</NavLink>
            <NavLink to="/library" className={navClass}>Library</NavLink>
          </nav>
          <div className="ml-auto min-w-0">
            <MemberMenu />
          </div>
        </div>
      </header>
      <main>
        {error && (
          <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <FormError>{error}</FormError>
            </div>
          </div>
        )}
        <Outlet />
      </main>
    </>
  );
}
