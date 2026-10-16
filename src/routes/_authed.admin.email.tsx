import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Mail, Send, Save, LockKeyhole } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [sender, setSender] = useState("");
  const [provider, setProvider] = useState("");
  const [customProvider, setCustomProvider] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched((previous) => ({ ...previous, [field]: true }));
  const emailInvalid = (value: string) => value !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const senderInvalid = Boolean(touched.sender && emailInvalid(sender));
  const recipientInvalid = Boolean(touched.recipient && emailInvalid(recipient));
  const portInvalid = Boolean(touched.port && port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535));
  const fieldClass = "h-10 bg-muted/40 shadow-none";

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title="Email Configuration" actions={<Mail className="h-5 w-5 text-primary" aria-hidden="true" />} />
      <form className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6" autoComplete="off" onSubmit={(event) => event.preventDefault()}>
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-primary" />
            <h2 className="font-display text-base font-semibold sm:text-lg">SMTP Configuration</h2>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" /> Not connected
          </span>
        </div>
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email-sender">Sender email</Label>
              <Input id="email-sender" type="email" className={fieldClass} value={sender} onChange={(event) => setSender(event.target.value)} onBlur={() => touch("sender")} aria-invalid={senderInvalid} aria-describedby={senderInvalid ? "sender-error" : undefined} />
              {senderInvalid && <p id="sender-error" className="text-xs text-destructive">Enter a valid email address.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-provider">Email provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="email-provider" className="h-10 w-full bg-muted/40 shadow-none"><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="microsoft">Microsoft 365</SelectItem>
                  <SelectItem value="google">Google Workspace</SelectItem>
                  <SelectItem value="custom">Custom provider</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {provider === "custom" && <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="custom-provider">Provider name</Label>
              <Input id="custom-provider" className={fieldClass} value={customProvider} onChange={(event) => setCustomProvider(event.target.value)} />
            </div>}
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
              <Label htmlFor="email-username">Username</Label>
              <Input id="email-username" className={fieldClass} value={username} onChange={(event) => setUsername(event.target.value)} autoCapitalize="none" spellCheck={false} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-password">Password / app password</Label>
              <div className="relative">
                <Input id="email-password" type={visible ? "text" : "password"} autoComplete="new-password" className={`${fieldClass} pr-12`} value={password} onChange={(event) => setPassword(event.target.value)} />
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-8 w-8 text-muted-foreground" aria-label={visible ? "Hide password" : "Show password"} title={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible((previous) => !previous)}>
                  {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
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
              <Button type="button" variant="outline" className="h-10 gap-2" disabled><Send className="h-4 w-4" /> Send test email</Button>
              <Button type="button" variant="outline" className="h-10 gap-2 border-primary/40 text-primary" disabled><Save className="h-4 w-4" /> Save configuration</Button>
            </div>
          </div>
          <span className="mt-4 inline-flex items-center gap-2 text-[11px] text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5 shrink-0" /> Configuration not connected</span>
        </div>
      </form>
    </div>
  );
}