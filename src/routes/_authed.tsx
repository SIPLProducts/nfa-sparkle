import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { SCREENS } from "@/lib/screens";
import { toast } from "@/lib/swal";

export const Route = createFileRoute("/_authed")({
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, loading, canAccess } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentScreen = SCREENS.find(({ path }) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`),
  );
  const firstAllowedPath = SCREENS.find(({ key }) => canAccess(key))?.path;
  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth", replace: true });
      return;
    }
    if (currentScreen && !canAccess(currentScreen.key)) {
      toast.error("You do not have permission to open this screen");
      if (firstAllowedPath && firstAllowedPath !== pathname) {
        nav({ to: firstAllowedPath, replace: true });
      }
    }
  }, [canAccess, currentScreen, firstAllowedPath, loading, nav, pathname, user]);
  if (loading || !user || (currentScreen && !canAccess(currentScreen.key))) {
    return <div className="flex min-h-screen items-center justify-center bg-[#eef3f8] text-slate-600">Loading…</div>;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}