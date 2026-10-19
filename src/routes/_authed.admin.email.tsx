import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "@/lib/swal";
import { getEmailConfig, getEmailLog, saveEmailConfig, sendTestEmail } from "@/lib/email-config.functions";
import { Eye, EyeOff, Mail, Send, Save, LockKeyhole, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authed/admin/email")({
  head: () => ({
    meta: [
      { title: "Email Configuration — NFA Portal" },
      { name: "description", content: "Email sender and server configuration for the NFA Portal." },
      { property: "og:title", content: "Email Configuration — NFA Portal" },
      { property: "og:description", content: "Email sender and server configuration for the NFA Portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmailConfiguration,
});

function EmailConfiguration() {
  const { canAccess } = useAuth();
  if (!canAccess("sap_api")) {
    return <p role="alert" className="text-sm text-muted-foreground">You do not have permission to open this screen.</p>;
  }
  return <EmailConfigurationForm />;
}

function EmailConfigurationForm() {
  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [encryption, setEncryption] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [ccList, setCcList] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState("");
  const [ccError, setCcError] = useState("");
  const [recipient, setRecipient] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched((previous) => ({ ...previous, [field]: true }));
  const emailInvalid = (value: string) => value !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const fromEmailInvalid = Boolean(touched.fromEmail && emailInvalid(fromEmail));
  const recipientInvalid = Boolean(touched.recipient && emailInvalid(recipient));
  const portInvalid = Boolean(touched.port && port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535));
  const fieldClass = "h-10 bg-muted/40 shadow-none";
  const loadFn = useServerFn(getEmailConfig);
  const saveFn = useServerFn(saveEmailConfig);
  const testFn = useServerFn(sendTestEmail);
  const [loaded, setLoaded] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadFn().then(({ config, hasPassword }) => {
      setEnabled(config.enabled); setHost(config.host); setPort(config.port ? String(config.port) : "");
      setEncryption(config.encryption); setUsername(config.username); setFromEmail(config.fromEmail);
      setFromName(config.fromName); setCcList(config.cc ?? []); setHasPassword(hasPassword);
    }).catch((e) => toast.error(e?.message ?? "Could not load email configuration")).finally(() => setLoaded(true));
  }, []);

  const save = async () => {
    if (portInvalid || emailInvalid(fromEmail)) return;
    setSaving(true);
    try {
      await saveFn({ data: { enabled, host, port: port ? Number(port) : null, encryption: encryption as any, username, fromEmail, fromName, cc: ccList, password: password || undefined } });
      if (password) setHasPassword(true);
      setPassword("");
      toast.success("Email configuration saved");
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); } finally { setSaving(false); }
  };
  const test = async () => {
    setTesting(true);
    try {
      const r = await testFn({ data: { to: recipient, draft: {
        enabled, host, port: port ? Number(port) : null, encryption: encryption as any,
        username, fromEmail, fromName, cc: ccList,
      }, password: password || undefined } });
      r.ok ? toast.success(r.message) : toast.error(r.message);
    } catch (e: any) { toast.error(e?.message ?? "Test email failed"); } finally { setTesting(false); }
  };
  const connected = hasPassword && Boolean(host && port && fromEmail);

  const addCc = (raw: string) => {
    const value = raw.trim().replace(/,$/, "");
    if (!value) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setCcError("Enter a valid email address.");
      return;
    }
    setCcError("");
    setCcList((previous) => (previous.includes(value) ? previous : [...previous, value]));
    setCcInput("");
  };
  const removeCc = (value: string) => setCcList((previous) => previous.filter((item) => item !== value));

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Email Configuration"
        actions={
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-success" : "bg-muted-foreground/50"}`} /> {connected ? (enabled ? "Sending on" : "Configured") : "Not connected"}
          </span>
        }
      />
      <form className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6" autoComplete="off" onSubmit={(event) => event.preventDefault()}>
        <div className="mb-5 flex items-start gap-2">
          <Mail className="mt-1 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold sm:text-xl">No Reply Email Configuration</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              System sender used for workflow notifications (approvals, submissions, alerts). Outbound notifications go through this account.
            </p>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold sm:text-base">Enable No-Reply Sending</p>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">When off, system notifications are not sent.</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable No-Reply Sending" />
        </div>

        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email-host">SMTP Host</Label>
            <Input id="email-host" className={fieldClass} value={host} onChange={(event) => setHost(event.target.value)} autoCapitalize="none" spellCheck={false} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-port">Port</Label>
            <Input id="email-port" inputMode="numeric" className={fieldClass} value={port} onChange={(event) => setPort(event.target.value.replace(/\D/g, ""))} onBlur={() => touch("port")} aria-invalid={portInvalid} aria-describedby={portInvalid ? "port-error" : undefined} />
            {portInvalid && <p id="port-error" className="text-xs text-destructive">Enter a port between 1 and 65535.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-encryption">Encryption</Label>
            <Select value={encryption} onValueChange={setEncryption}>
              <SelectTrigger id="email-encryption" className="h-10 w-full bg-muted/40 shadow-none"><SelectValue placeholder="Select encryption" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tls">TLS (587)</SelectItem>
                <SelectItem value="ssl">SSL (465)</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-username">Username</Label>
            <Input id="email-username" className={fieldClass} value={username} onChange={(event) => setUsername(event.target.value)} autoCapitalize="none" spellCheck={false} />
            <p className="text-[11px] text-muted-foreground">Use the full mailbox address (e.g. same as From Email).</p>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <Label htmlFor="email-password">App Password</Label>
              <span className="text-xs text-muted-foreground">(leave empty to keep existing)</span>
            </div>
            <div className="relative">
              <Input id="email-password" type={visible ? "text" : "password"} autoComplete="new-password" className={`${fieldClass} pr-12`} value={password} onChange={(event) => setPassword(event.target.value)} />
              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-8 w-8 text-muted-foreground" aria-label={visible ? "Hide app password" : "Show app password"} title={visible ? "Hide app password" : "Show app password"} aria-pressed={visible} onClick={() => setVisible((previous) => !previous)}>
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-from">From Email</Label>
            <Input id="email-from" type="email" className={fieldClass} value={fromEmail} onChange={(event) => setFromEmail(event.target.value)} onBlur={() => touch("fromEmail")} aria-invalid={fromEmailInvalid} aria-describedby={fromEmailInvalid ? "from-email-error" : undefined} />
            {fromEmailInvalid && <p id="from-email-error" className="text-xs text-destructive">Enter a valid email address.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-from-name">From Name</Label>
            <Input id="email-from-name" className={fieldClass} value={fromName} onChange={(event) => setFromName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-cc">CC Recipients <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            <div className="min-h-10 rounded-md border border-input bg-muted/40 px-2 py-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {ccList.map((value) => (
                  <span key={value} className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <span className="truncate">{value}</span>
                    <button type="button" className="shrink-0 rounded-full p-0.5 hover:bg-primary/15" aria-label={`Remove ${value}`} onClick={() => removeCc(value)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <Input
                  id="email-cc"
                  className="h-7 min-w-32 flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                  placeholder={ccList.length === 0 ? "Add recipient and press Enter" : "Add another..."}
                  value={ccInput}
                  onChange={(event) => setCcInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCc(ccInput);
                    } else if (event.key === ",") {
                      event.preventDefault();
                      addCc(ccInput);
                    }
                  }}
                  onBlur={() => ccInput.trim() && addCc(ccInput)}
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
            </div>
            {ccError && <p className="text-xs text-destructive">{ccError}</p>}
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="test-recipient">Send test to</Label>
              <Input id="test-recipient" type="email" className={`${fieldClass} lg:max-w-sm`} value={recipient} onChange={(event) => setRecipient(event.target.value)} onBlur={() => touch("recipient")} aria-invalid={recipientInvalid} aria-describedby={recipientInvalid ? "recipient-error" : undefined} />
              {recipientInvalid && <p id="recipient-error" className="text-xs text-destructive">Enter a valid email address.</p>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:shrink-0">
              <Button type="button" variant="outline" className="h-10 gap-2" disabled={!loaded || testing || !recipient || emailInvalid(recipient)} onClick={test}><Send className="h-4 w-4" /> {testing ? "Sending…" : "Send test email"}</Button>
              <Button type="button" variant="outline" className="h-10 gap-2 border-primary/40 text-primary" disabled={!loaded || saving} onClick={save}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save configuration"}</Button>
            </div>
          </div>
          <span className="mt-4 inline-flex items-center gap-2 text-[11px] text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5 shrink-0" /> {hasPassword ? "App password saved securely on the server" : "App password not saved yet"}</span>
        </div>
      </form>
      <EmailActivity />
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  approve: "Approved", final_approve: "Final approval", reject: "Rejected",
  back_to_initiator: "Back to initiator", clarification: "Clarification",
};

function EmailActivity() {
  const logFn = useServerFn(getEmailLog);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getEmailLog>>>([]);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); logFn().then(setRows).catch(() => setRows([])).finally(() => setLoading(false)); };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Recent email activity</h2>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{loading ? "Loading…" : "No workflow emails yet."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="py-2 pr-3">Time</th><th className="py-2 pr-3">ENFA</th><th className="py-2 pr-3">Action</th><th className="py-2 pr-3">Result</th><th className="py-2 pr-3">Sent to</th><th className="py-2">Details</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3">{r.enfa_no}</td>
                  <td className="py-2 pr-3">{ACTION_LABEL[r.action] ?? r.action}</td>
                  <td className={`py-2 pr-3 font-medium ${r.status === "sent" ? "text-primary" : r.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{r.status === "sent" ? "Sent" : r.status === "failed" ? "Failed" : "Skipped"}</td>
                  <td className="py-2 pr-3 break-all">{r.recipients.join(", ") || "—"}</td>
                  <td className="py-2 text-muted-foreground">{r.error || (r.people.length ? `For: ${r.people.join(", ")}` : "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
