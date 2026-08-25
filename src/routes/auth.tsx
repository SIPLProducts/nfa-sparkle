import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureDemoUser } from "@/lib/demo-user.functions";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck, Workflow, FileCheck2, Lock } from "lucide-react";
import ramkyLogo from "@/assets/ramky-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in - NFA Portal" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/", replace: true });
  }, [loading, user, nav]);

  async function signIn() {
    setBusy(true);
    try {
      const login = email.trim();
      let loginEmail = login;
      if (login && !login.includes("@")) {
        const { data } = await supabase.rpc("resolve_login_email", { _login: login });
        loginEmail = (data as string | null) ?? "";
      }
      if (!loginEmail) {
        toast.error("Invalid login credentials");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: pwd });
      if (error) toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function signInDemo() {
    setBusy(true);
    try {
      const creds = await ensureDemoUser();
      setEmail(creds.email);
      setPwd(creds.password);
      const { error } = await supabase.auth.signInWithPassword({ email: creds.email, password: creds.password });
      if (error) toast.error(error.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Demo sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 bg-slate-50">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand to-brand-2 p-12 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.18) 0, transparent 45%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-white p-2 shadow-sm ring-1 ring-white/25">
            <img src={ramkyLogo.url} alt="Ramky Estates" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-wide">NFA Portal</div>
            <div className="text-xs text-white/70">Note For Approval · SAP Integrated</div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-semibold leading-tight">
            Govern approvals with<br />
            <span className="text-white/90">enterprise-grade control.</span>
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/75">
            Initiate, route and approve Notes For Approval across companies, projects and functions —
            backed by your SAP master data and a complete audit trail.
          </p>
          <ul className="space-y-3 text-sm text-white/85">
            <li className="flex items-center gap-3"><Workflow className="h-4 w-4 text-white/70" /> Multi-level approval chains</li>
            <li className="flex items-center gap-3"><FileCheck2 className="h-4 w-4 text-white/70" /> Attachments, comments & audit log</li>
            <li className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-white/70" /> Role-based access & RLS security</li>
          </ul>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-white/60">
          <span>© {new Date().getFullYear()} Your Company. All rights reserved.</span>
          <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Secure SSO</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden flex items-center gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md border border-border bg-card p-1.5 shadow-sm ring-1 ring-border/40">
              <img src={ramkyLogo.url} alt="Ramky Estates" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="text-base font-semibold text-slate-900">NFA Portal</div>
              <div className="text-xs text-slate-500">Note For Approval · SAP Integrated</div>
            </div>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl font-semibold text-slate-900">Welcome back</CardTitle>
              <p className="text-sm text-slate-500">Sign in to access your approvals workspace.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="signin-email">User ID / Email</Label>
                    <Input id="signin-email" placeholder="Enter your User ID or Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-pwd">Password</Label>
                      <a href="#" className="text-xs text-brand hover:underline">Forgot password?</a>
                    </div>
                    <Input id="signin-pwd" placeholder="••••••••" value={pwd} onChange={(e) => setPwd(e.target.value)} type="password" autoComplete="current-password" />
                  </div>
                  <Button onClick={signIn} disabled={busy} className="w-full bg-brand hover:bg-brand-2 text-primary-foreground">
                    {busy ? "Signing in…" : "Sign in"}
                  </Button>
                  <p className="pt-1 text-center text-xs text-slate-500">
                    Protected by role-based access. Unauthorized use is prohibited.
                  </p>

                  <div className="mt-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Demo account</div>
                    <div className="mb-2 space-y-0.5 font-mono text-xs text-slate-700">
                      <div><span className="text-slate-500">User ID:</span> demo@nfa.local</div>
                      <div><span className="text-slate-500">Password:</span> Demo@12345</div>
                    </div>
                    <Button onClick={signInDemo} disabled={busy} variant="outline" size="sm" className="w-full border-slate-300">
                      {busy ? "Signing in…" : "Login as Demo User"}
                    </Button>
                  </div>
              </div>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-slate-500">
            Need help? Contact <a className="text-brand underline-offset-2 hover:underline" href="mailto:it-support@company.com">IT Support</a>
          </p>
        </div>
      </div>
    </div>
  );
}