import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2, ShieldCheck, Workflow, FileCheck2, Lock } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in - NFA Portal" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/", replace: true });
  }, [loading, user, nav]);

  async function signIn() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    setBusy(false);
    if (error) toast.error(error.message);
  }
  async function signUp() {
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: pwd,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. You can sign in now.");
  }
  async function google() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error(res.error.message ?? "Google sign-in failed");
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 bg-slate-50">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0b2545] via-[#13315c] to-[#1e5f8c] p-12 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.18) 0, transparent 45%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <Building2 className="h-6 w-6" />
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
            <div className="grid h-10 w-10 place-items-center rounded-md bg-[#0b2545] text-white">
              <Building2 className="h-5 w-5" />
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
              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Request access</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="space-y-4 pt-5">
                  <Button onClick={google} variant="outline" className="w-full border-slate-300">
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.48 12c0-.73.13-1.44.36-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/></svg>
                    Continue with Google
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
                    <div className="relative flex justify-center"><span className="bg-card px-2 text-xs uppercase tracking-wider text-slate-400">or with email</span></div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Work email</Label>
                    <Input id="signin-email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-pwd">Password</Label>
                      <a href="#" className="text-xs text-[#13315c] hover:underline">Forgot password?</a>
                    </div>
                    <Input id="signin-pwd" placeholder="••••••••" value={pwd} onChange={(e) => setPwd(e.target.value)} type="password" autoComplete="current-password" />
                  </div>
                  <Button onClick={signIn} disabled={busy} className="w-full bg-[#0b2545] hover:bg-[#13315c]">
                    {busy ? "Signing in…" : "Sign in"}
                  </Button>
                  <p className="pt-1 text-center text-xs text-slate-500">
                    Protected by role-based access. Unauthorized use is prohibited.
                  </p>
                </TabsContent>

                <TabsContent value="signup" className="space-y-4 pt-5">
                  <div className="space-y-2">
                    <Label htmlFor="su-name">Full name</Label>
                    <Input id="su-name" placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Work email</Label>
                    <Input id="su-email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-pwd">Password</Label>
                    <Input id="su-pwd" placeholder="At least 8 characters" value={pwd} onChange={(e) => setPwd(e.target.value)} type="password" autoComplete="new-password" />
                  </div>
                  <Button onClick={signUp} disabled={busy} className="w-full bg-[#0b2545] hover:bg-[#13315c]">
                    {busy ? "Creating…" : "Create account"}
                  </Button>
                  <Button onClick={google} variant="outline" className="w-full border-slate-300">Continue with Google</Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-slate-500">
            Need help? Contact <a className="text-[#13315c] underline-offset-2 hover:underline" href="mailto:it-support@company.com">IT Support</a>
          </p>
        </div>
      </div>
    </div>
  );
}