import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { FileText, Inbox, BarChart3, Plus, Users, LogOut } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, hasRole, signOut } = useAuth();
  const nav = useNavigate();

  const navItem = (to: string, icon: ReactNode, label: string) => (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-sky-100"
      activeProps={{ className: "bg-sky-200 font-medium text-slate-900" }}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#eef3f8] text-slate-800">
      <header className="border-b border-slate-300 bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-2">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-bold italic tracking-wide text-slate-700">
              NFA Portal
            </Link>
            <nav className="flex items-center gap-1">
              {navItem("/nfa/new", <Plus className="h-4 w-4" />, "Create NFA")}
              {navItem("/nfa/my", <FileText className="h-4 w-4" />, "My NFAs")}
              {navItem("/approvals", <Inbox className="h-4 w-4" />, "Approvals")}
              {navItem("/report", <BarChart3 className="h-4 w-4" />, "E-NFA Report")}
              {hasRole("admin") && navItem("/admin/users", <Users className="h-4 w-4" />, "Admin")}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">{user?.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut();
                nav({ to: "/auth" });
              }}
            >
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] p-4">{children}</main>
    </div>
  );
}