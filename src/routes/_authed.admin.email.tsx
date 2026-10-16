import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Eye, EyeOff, Mail, Send, Server, Save, LockKeyhole } from "lucide-react";
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

function SettingsSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="grid gap-5 border-b border-border py-7 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
      <div className="flex items-center gap-3 lg:items-start">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">{icon}</span>
        <h2 className="pt-1.5 font-sans text-base font-semibold tracking-normal">{title}</h2>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
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
  const fieldClass = "h-11 bg-card";

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader eyebrow="Admin" title="Email Configuration" actions={
        <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> Not connected
        </span>
      } />
      <form autoComplete="off" onSubmit={(event) => event.preventDefault()}>
        <SettingsSection icon={<Mail className="h-4 w-4" />} title="Sender">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email-sender">Sender email</Label>
              <Input id="email-sender" type="email" className={fieldClass} value={sender} onChange={(event) => setSender(event.target.value)} onBlur={() => touch("sender")} aria-invalid={senderInvalid} aria-describedby={senderInvalid ? "sender-error" : undefined} />
              {senderInvalid && <p id="sender-error" className="text-xs text-destructive">Enter a valid email address.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-provider">Email provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="email-provider" className="h-11 w-full bg-card"><SelectValue placeholder="Select provider" /></SelectTrigger>
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
          </div>
        </SettingsSection>
        <SettingsSection icon={<Server className="h-4 w-4" />} title="Email server">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email-host">Host</Label>
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
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-9 w-9 text-muted-foreground" aria-label={visible ? "Hide password" : "Show password"} title={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible((previous) => !previous)}>
                  {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </SettingsSection>
        <SettingsSection icon={<Send className="h-4 w-4" />} title="Test email">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="space-y-2">
              <Label htmlFor="test-recipient">Recipient email</Label>
              <Input id="test-recipient" type="email" className={fieldClass} value={recipient} onChange={(event) => setRecipient(event.target.value)} onBlur={() => touch("recipient")} aria-invalid={recipientInvalid} aria-describedby={recipientInvalid ? "recipient-error" : undefined} />
              {recipientInvalid && <p id="recipient-error" className="text-xs text-destructive">Enter a valid email address.</p>}
            </div>
            <Button type="button" variant="outline" className="h-11 gap-2 sm:mt-7" disabled><Send className="h-4 w-4" /> Send test email</Button>
          </div>
        </SettingsSection>
        <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-4 w-4 shrink-0" /> Configuration not connected</span>
          <Button type="button" className="h-11 gap-2" disabled><Save className="h-4 w-4" /> Save configuration</Button>
        </div>
      </form>
    </div>
  );
}