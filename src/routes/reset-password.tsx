import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/swal";
import { AnumatiWordmark } from "@/components/brand/AnumatiWordmark";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Anumati – Reset password" },
    { name: "description", content: "Set a new password for your Anumati eNFA portal account." },
    { property: "og:title", content: "Anumati – Reset password" },
    { property: "og:description", content: "Set a new password for your Anumati eNFA portal account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const token_hash = p.get("token_hash");
    if (!token_hash || p.get("type") !== "recovery") { setState("invalid"); return; }
    supabase.auth.verifyOtp({ token_hash, type: "recovery" }).then(({ error }) => {
      setState(error ? "invalid" : "ready");
      window.history.replaceState(null, "", "/reset-password");
    });
  }, []);

  async function save() {
    if (pwd.length < 8) return toast.error("Password must be at least 8 characters");
    if (pwd !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) return toast.error(error.message);
      await supabase.auth.signOut();
      toast.success("Password updated. Please sign in with your new password.");
      nav({ to: "/auth", replace: true });
    } finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-login-surface p-4 font-sans text-ink">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center"><AnumatiWordmark /></div>
        <Card className="border-field-border shadow-sm">
          <CardHeader><CardTitle className="font-display text-2xl">Reset password</CardTitle></CardHeader>
          <CardContent>
            {state === "checking" && <p className="text-sm text-muted-foreground">Checking your reset link…</p>}
            {state === "invalid" && (
              <div className="space-y-4">
                <p className="text-sm text-destructive">This reset link is invalid or has expired. Please request a new one.</p>
                <Button asChild className="w-full bg-brand-blue text-primary-foreground hover:bg-brand-blue/90"><Link to="/auth">Back to sign in</Link></Button>
              </div>
            )}
            {state === "ready" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-pwd" className="text-[13px] font-semibold">New password</Label>
                  <Input id="new-pwd" type="password" className="h-11 border-field-border" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-pwd" className="text-[13px] font-semibold">Confirm password</Label>
                  <Input id="confirm-pwd" type="password" className="h-11 border-field-border" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
                </div>
                <Button onClick={save} disabled={busy} className="h-11 w-full bg-brand-blue text-sm font-semibold text-primary-foreground hover:bg-brand-blue/90">
                  {busy ? "Saving…" : "Set new password"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
