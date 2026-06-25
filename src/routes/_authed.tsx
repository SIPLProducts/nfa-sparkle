import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authed")({
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth", replace: true });
  }, [loading, user, nav]);
  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-[#eef3f8] text-slate-600">Loading…</div>;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}