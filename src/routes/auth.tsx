import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { resolveLoginId } from "@/lib/auth-login.functions";

import { useAuth } from "@/lib/auth-context";
import { SCREENS } from "@/lib/screens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/swal";
import { AnumatiWordmark } from "@/components/brand/AnumatiWordmark";
import { ShieldCheck, Workflow, FileCheck2, Lock } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Anumati – Sign in" },
    { name: "description", content: "Sign in to manage eNFA requests, approvals, and SAP reports." },
    { property: "og:title", content: "Anumati – Sign in" },
    { property: "og:description", content: "Sign in to manage eNFA requests, approvals, and SAP reports." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, canAccess } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const resolveLogin = useServerFn(resolveLoginId);
  const firstAllowedPath = SCREENS.find(({ key }) => canAccess(key))?.path ?? "/";

  useEffect(() => {
    if (!loading && user) nav({ to: firstAllowedPath, replace: true });
  }, [loading, user, nav, firstAllowedPath]);

  async function signIn() {
    setBusy(true);
    try {
      const login = email.trim();
      if (!login) {
        toast.error("Enter your User ID or Email");
        return;
      }
      const { EMAIL } = await resolveLogin({ data: { LOGIN_ID: login } });
      if (!EMAIL) {
        toast.error("Invalid login credentials");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: pwd });
      if (error) toast.error(error.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:h-dvh lg:grid-cols-2 lg:overflow-hidden bg-login-surface font-sans text-ink">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between gap-[2vh] overflow-hidden bg-deep-blue p-[clamp(1.5rem,5vh,3rem)] text-white">
        <div className="flex items-center gap-4">
          <img src="/ramky-logo-trim.png" alt="Ramky Estates" className="h-[clamp(2.5rem,7vh,3.5rem)] w-auto object-contain" />
          <div className="h-10 w-px bg-white/30" />
          <div>
            <div className="text-sm font-semibold">Note For Approval</div>
            <div className="text-xs text-on-deep-muted">SAP Integrated</div>
          </div>
        </div>

        <div className="flex flex-col gap-[clamp(0.75rem,3vh,2rem)]">
          <div className="flex gap-2">
            <span className="h-2.5 w-2.5 bg-brand-orange" />
            <span className="h-2.5 w-2.5 bg-brand-sky-accent" />
            <span className="h-2.5 w-2.5 bg-brand-green" />
          </div>
          <AnumatiWordmark tone="dark" size={88} maxVh={10} />
          <h1 className="font-serif text-[clamp(1.6rem,4.5vh,2.5rem)] font-normal leading-tight">
            Paperless approvals, with a<br />complete trail.
          </h1>
          <p className="max-w-md text-[15px] leading-relaxed text-on-deep">
            Raise, route and approve Notes For Approval across companies, projects and functions,
            linked to your SAP master data with every step recorded.
          </p>
          <ul className="space-y-[clamp(0.35rem,1.4vh,0.75rem)] text-sm text-on-deep">
            <li className="flex items-center gap-3"><Workflow className="h-4 w-4 text-sky" strokeWidth={1.8} /> Multi-level approval chains</li>
            <li className="flex items-center gap-3"><FileCheck2 className="h-4 w-4 text-sky" strokeWidth={1.8} /> Attachments, comments & audit log</li>
            <li className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-sky" strokeWidth={1.8} /> Role-based access & RLS security</li>
          </ul>
        </div>

        <div className="flex items-center justify-between text-xs text-on-deep-muted">
          <span>© {new Date().getFullYear()} Sharvi Infotech. All rights reserved.</span>
          <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Secure SSO</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center overflow-y-auto p-6 sm:p-10 lg:p-[clamp(1rem,4vh,2.5rem)]">
        <div className="w-full max-w-md">
          <div className="mb-[clamp(0.75rem,3vh,1.5rem)] flex justify-center">
            <AnumatiWordmark size={52} align="center" maxVh={6.5} />
          </div>

          <Card className="border-border shadow-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="font-serif text-2xl font-normal text-ink">Welcome</CardTitle>
              <p className="text-sm text-grey-text">Sign in to access your approvals workspace.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-[13px] font-semibold">User ID / Email</Label>
                  <Input id="signin-email" className="h-11 border-field-border" placeholder="Enter your User ID or Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-pwd" className="text-[13px] font-semibold">Password</Label>
                    <a href="#" className="text-xs text-brand-blue underline">Forgot password?</a>
                  </div>
                  <Input id="signin-pwd" className="h-11 border-field-border" placeholder="••••••••" value={pwd} onChange={(e) => setPwd(e.target.value)} type="password" autoComplete="current-password" />
                </div>
                <Button onClick={signIn} disabled={busy} className="h-11 w-full bg-brand-blue text-sm font-semibold text-primary-foreground hover:bg-brand-blue/90">
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
                <p className="pt-1 text-center text-xs text-grey-text">
                  Protected by role-based access. Unauthorized use is prohibited.
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-grey-text">
            Need help? Contact <a className="text-brand-blue underline" href="mailto:it-support@company.com">IT Support</a>
          </p>
        </div>
      </div>
    </div>
  );
}