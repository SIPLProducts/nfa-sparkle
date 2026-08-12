import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { StatusLegend } from "@/components/StatusLegend";
import { AuditHistoryDrawer } from "@/components/AuditHistoryDrawer";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import {
  FileText,
  Inbox,
  BarChart3,
  History,
  PlusCircle,
  Users,
  LogOut,
  LayoutDashboard,
  Building2,
  Search,
  Bell,
  Menu,
  Plug,
} from "lucide-react";
import { useState, type ReactNode } from "react";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; section: string }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, section: "Workspace" },
  { to: "/nfa/new", label: "Create NFA", icon: PlusCircle, section: "Workspace" },
  { to: "/nfa/my", label: "My NFAs", icon: FileText, section: "Workspace" },
  { to: "/approvals", label: "Approvals", icon: Inbox, section: "Workspace" },
  { to: "/report", label: "E-NFA Report", icon: BarChart3, section: "Insights" },
];

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { user, hasRole, signOut } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/"));

  const sections = Array.from(new Set(NAV.map((n) => n.section)));
  const [mobileOpen, setMobileOpen] = useState(false);

  const navList = (
    <>
      {sections.map((sec) => (
        <div key={sec} className="mt-4">
          <div className="px-3 pb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">{sec}</div>
          <ul className="space-y-0.5">
            {NAV.filter((n) => n.section === sec).map((n) => {
              const Icon = n.icon;
              const active = isActive(n.to);
              return (
                <li key={n.to}>
                  <Link
                    to={n.to}
                    onClick={() => setMobileOpen(false)}
                    className={
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition " +
                      (active
                        ? "bg-sidebar-accent text-white shadow-sm"
                        : "text-white/75 hover:bg-sidebar-accent/60 hover:text-white")
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{n.label}</span>
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {hasRole("admin") && (
        <div className="mt-4">
          <div className="px-3 pb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">Admin</div>
          <Link
            to="/admin/sap-api"
            onClick={() => setMobileOpen(false)}
            className={
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition " +
              (isActive("/admin/sap-api")
                ? "bg-sidebar-accent text-white shadow-sm"
                : "text-white/75 hover:bg-sidebar-accent/60 hover:text-white")
            }
          >
            <Plug className="h-4 w-4" /> SAP API Settings
          </Link>
        </div>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-sidebar-accent ring-1 ring-white/10">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-base font-bold tracking-tight text-white">NFA Portal</div>
            <div className="truncate text-[11px] uppercase tracking-[0.14em] text-white/55">SAP Integrated</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {navList}
        </nav>
        <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-white/50">
          v1.0 · © {new Date().getFullYear()} Your Company
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden -ml-2" aria-label="Open navigation">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
                  <SheetHeader className="border-b border-sidebar-border px-5 py-4 text-left">
                    <SheetTitle className="flex items-center gap-3 text-white">
                      <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-accent ring-1 ring-white/10">
                        <Building2 className="h-4 w-4 text-white" />
                      </div>
                      <div className="leading-tight">
                        <div className="font-display text-base font-bold">NFA Portal</div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">SAP Integrated</div>
                      </div>
                    </SheetTitle>
                  </SheetHeader>
                  <nav className="overflow-y-auto px-3 pb-6">{navList}</nav>
                </SheetContent>
              </Sheet>
              <div className="hidden md:flex min-w-0 flex-col">
                {title && <h1 className="font-display truncate text-lg font-bold">{title}</h1>}
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
              </div>
              <div className="md:hidden font-display text-lg font-bold">NFA Portal</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative hidden lg:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search NFA #, subject…"
                  className="h-9 w-72 rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-ring/20 transition focus:ring-2"
                />
              </div>
              <Button variant="ghost" size="icon" className="hidden sm:inline-flex text-muted-foreground hover:text-foreground">
                <Bell className="h-4 w-4" />
              </Button>
              <AuditHistoryDrawer />
              <StatusLegend compact />
              <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 sm:flex">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {(user?.email ?? "U").slice(0, 1).toUpperCase()}
                </div>
                <div className="leading-tight">
                  <div className="max-w-[160px] truncate text-xs font-medium">{user?.email}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Initiator</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="px-2 sm:px-3"
                onClick={async () => {
                  await signOut();
                  nav({ to: "/auth" });
                }}
              >
                <LogOut className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
          {(title || actions) && (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border/60 bg-card px-4 py-3 sm:px-6 md:hidden">
              <div className="min-w-0">
                {title && <h1 className="font-display truncate text-base font-bold">{title}</h1>}
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
              </div>
              {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
            </div>
          )}
          {actions && (
            <div className="hidden border-t border-border/60 bg-card px-6 py-2 md:flex md:items-center md:justify-end">
              {actions}
            </div>
          )}
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}