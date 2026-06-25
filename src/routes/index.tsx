import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Inbox, BarChart3, Plus } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NFA Portal - Note For Approval" },
      { name: "description", content: "Create, approve and report Notes For Approval connected to SAP." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth", replace: true });
  }, [loading, user, nav]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-[#eef3f8] text-slate-600">Loading…</div>;
  }

  const tile = (to: string, icon: React.ReactNode, title: string, desc: string) => (
    <Link to={to}>
      <Card className="h-full transition hover:border-sky-400 hover:shadow-md">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="rounded-md bg-sky-100 p-2 text-sky-700">{icon}</div>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">{desc}</CardContent>
      </Card>
    </Link>
  );

  return (
    <AppShell>
      <h1 className="mb-6 text-xl font-semibold text-slate-700">Note For Approval — Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {tile("/nfa/new", <Plus className="h-5 w-5" />, "Create NFA", "Raise a new Note For Approval")}
        {tile("/nfa/my", <FileText className="h-5 w-5" />, "My NFAs", "Edit, upload docs, track status")}
        {tile("/approvals", <Inbox className="h-5 w-5" />, "Approvals", "Approve / Reject / Send Back")}
        {tile("/report", <BarChart3 className="h-5 w-5" />, "E-NFA Report", "Filter and export NFAs")}
      </div>
    </AppShell>
  );
}