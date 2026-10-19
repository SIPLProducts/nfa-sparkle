/** Server-only SMTP configuration storage and workflow notification sending. */

export interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number | null;
  encryption: "" | "tls" | "ssl" | "none";
  username: string;
  fromEmail: string;
  fromName: string;
  cc: string[];
}

export const EMPTY_EMAIL_CONFIG: EmailConfig = {
  enabled: false, host: "", port: null, encryption: "", username: "", fromEmail: "", fromName: "", cc: [],
};

const CONFIG_KEY = "email_config";
const PASSWORD_KEY = "smtp_app_password";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function readSecret(key: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db.from("sap_secret").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

async function writeSecret(key: string, value: string) {
  const db = await admin();
  const { error } = await db.from("sap_secret").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function loadEmailConfig(): Promise<{ config: EmailConfig; hasPassword: boolean }> {
  const raw = await readSecret(CONFIG_KEY);
  let config = { ...EMPTY_EMAIL_CONFIG };
  if (raw) {
    try { config = { ...config, ...(JSON.parse(raw) as Partial<EmailConfig>) }; } catch { /* keep empty */ }
  }
  return { config, hasPassword: Boolean(await readSecret(PASSWORD_KEY)) };
}

export async function storeEmailConfig(config: EmailConfig, password?: string) {
  await writeSecret(CONFIG_KEY, JSON.stringify(config));
  if (password) await writeSecret(PASSWORD_KEY, password);
}

async function transport(override?: Partial<EmailConfig>, overridePassword?: string) {
  const saved = (await loadEmailConfig()).config;
  const config: EmailConfig = { ...saved };
  if (override) {
    for (const [k, v] of Object.entries(override)) {
      if (v !== undefined && v !== null && v !== "") (config as any)[k] = typeof v === "string" ? v.trim() : v;
    }
  }
  const password = overridePassword || (await readSecret(PASSWORD_KEY)) || "";
  const missing = [
    !config.host && "SMTP Host",
    !config.port && "Port",
    !config.fromEmail && "From Email",
  ].filter(Boolean);
  if (missing.length) throw new Error(`Enter ${missing.join(", ")}`);
  if (config.username && !password) throw new Error("Enter the App Password");
  const port = config.port!;
  const ssl = config.encryption === "ssl" || (config.encryption !== "none" && port === 465);
  const from = config.fromName ? `"${config.fromName.replace(/"/g, "")}" <${config.fromEmail}>` : config.fromEmail;
  const smtp = { host: config.host, port, secure: ssl, ignoreTLS: config.encryption === "none", user: config.username, pass: password };

  // The hosted site cannot open mail ports, so relay through the on-prem middleware when it is configured.
  const db = await admin();
  const [{ data: mw }, secret] = await Promise.all([
    db.from("sap_middleware_config").select("url, connection_mode").limit(1).maybeSingle(),
    readSecret("middleware_secret"),
  ]);
  const relayUrl = mw?.connection_mode === "proxy" && mw?.url ? `${String(mw.url).replace(/\/+$/, "")}/mail/send` : "";

  const transporter = {
    async sendMail(msg: { from: string; to: string | string[]; cc?: string[]; subject: string; text?: string; html?: string }) {
      if (relayUrl) {
        const res = await fetch(relayUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-proxy-secret": (secret ?? "").trim(), "ngrok-skip-browser-warning": "1" },
          body: JSON.stringify({ smtp, ...msg, to: Array.isArray(msg.to) ? msg.to : [msg.to] }),
        });
        const body = await res.json().catch(() => ({} as any));
        if (res.status === 404) throw new Error("The middleware does not support email yet. Update and restart the middleware.");
        if (!res.ok || !body?.ok) {
          const err: any = new Error(body?.error || `Email relay failed (${res.status})`);
          err.code = body?.code;
          throw err;
        }
        return body;
      }
      const nodemailer = (await import("nodemailer")).default;
      const t = nodemailer.createTransport({
        host: smtp.host, port, secure: ssl, ignoreTLS: smtp.ignoreTLS,
        connectionTimeout: 15_000, greetingTimeout: 15_000,
        auth: smtp.user ? { user: smtp.user, pass: password } : undefined,
      });
      return t.sendMail(msg);
    },
  };
  return { transporter, from, config };
}

/** Converts SMTP/socket errors into plain messages. */
export function friendlyMailError(e: any): string {
  const code = String(e?.code ?? "");
  const msg = String(e?.message ?? e ?? "");
  if (code === "EAUTH" || /535|username and password not accepted|invalid login/i.test(msg))
    return "The mail server rejected the username or App Password. Use the full mailbox address and a 16-character App Password.";
  if (/proxy request failed|TLS Handshake Failed/i.test(msg))
    return "This server cannot open mail connections (hosted preview). Test on the local or Quality server.";
  if (code === "ETIMEDOUT" || /timeout/i.test(msg)) return "The mail server did not respond in time. Check host, port and firewall.";
  if (code === "ECONNECTION" || code === "ESOCKET" || /ECONNREFUSED|ENOTFOUND/i.test(msg))
    return `Cannot reach the mail server (${msg}). Check host, port and encryption.`;
  return msg || "Email could not be sent";
}

export async function sendTestMail(to: string, override?: Partial<EmailConfig>, password?: string) {
  const { transporter, from } = await transport(override, password);
  try {
    await transporter.sendMail({
      from, to,
      subject: "NFA Portal test email",
      text: "This is a test email from the NFA Portal email configuration.",
    });
  } catch (e) {
    throw new Error(friendlyMailError(e));
  }
}

/* ----------------------------- recipients ----------------------------- */

export type WorkflowAction = "approve" | "reject" | "back_to_initiator" | "clarification";

export interface WorkflowNotifyContext {
  subject?: string;
  initiator?: string;
  /** Approver identifiers (User ID or name) by level, from the SAP worklist row. */
  approvers?: string[];
  /** Level the acting approver is at (1-based). */
  level?: number;
}

/** Picks recipients by action: pure, so it can be tested. */
export function pickRecipients(action: WorkflowAction, ctx: WorkflowNotifyContext): { people: string[]; final: boolean } {
  const approvers = (ctx.approvers ?? []).map((a) => a.trim());
  const total = approvers.reduce((last, a, i) => (a ? i + 1 : last), 0);
  const level = Math.max(1, ctx.level ?? 1);
  const initiator = ctx.initiator?.trim() ?? "";
  if (action === "approve") {
    if (level >= total) return { people: [initiator], final: true };
    return { people: [approvers[level] ?? ""], final: false };
  }
  if (action === "clarification") return { people: [initiator, ...approvers.slice(0, level)], final: false };
  return { people: [initiator], final: false };
}

async function resolveEmails(identifiers: string[]): Promise<string[]> {
  const wanted = Array.from(new Set(identifiers.map((v) => v.trim().toLowerCase()).filter(Boolean)));
  if (!wanted.length) return [];
  const db = await admin();
  const { data } = await db.from("profiles").select("username, full_name, email, status");
  const out = new Set<string>();
  for (const p of (data ?? []) as Array<{ username: string | null; full_name: string | null; email: string | null; status: string | null }>) {
    if (!p.email || String(p.status ?? "").toUpperCase() === "DELETED") continue;
    const keys = [p.username, p.full_name, p.email].map((v) => String(v ?? "").trim().toLowerCase());
    if (keys.some((k) => k && wanted.includes(k))) out.add(p.email.trim());
  }
  return Array.from(out);
}

const LABELS: Record<WorkflowAction, string> = {
  approve: "Approved",
  reject: "Rejected",
  back_to_initiator: "Sent back to initiator",
  clarification: "Clarification requested",
};

export async function notifyWorkflowAction(input: {
  action: WorkflowAction;
  enfaNo: string;
  comment: string;
  actor: string;
  actorEmail: string;
  context: WorkflowNotifyContext;
}) {
  const { config } = await loadEmailConfig();
  if (!config.enabled) {
    console.info(`[workflow-mail] ${input.enfaNo} ${input.action}: sending disabled`);
    return;
  }
  const mail = await buildWorkflowMail(input);
  if (!mail.to.length) {
    console.warn(`[workflow-mail] ${input.enfaNo} ${input.action}: no recipient email found for`, mail.people.join(", ") || "(none)");
    return;
  }
  const { transporter, from } = await transport();
  try {
    await transporter.sendMail({ from, to: mail.to, cc: config.cc.length ? config.cc : undefined, subject: mail.subject, text: mail.text });
    console.info(`[workflow-mail] ${input.enfaNo} ${input.action}: sent to ${mail.to.join(", ")}`);
  } catch (e) {
    console.warn(`[workflow-mail] ${input.enfaNo} ${input.action}: failed — ${friendlyMailError(e)}`);
  }
}

/** Works out recipients and text without sending (used for dry-run checks). */
export async function buildWorkflowMail(input: {
  action: WorkflowAction; enfaNo: string; comment: string; actor: string; actorEmail: string; context: WorkflowNotifyContext;
}) {
  const { people, final } = pickRecipients(input.action, input.context);
  const to = (await resolveEmails(people)).filter((e) => input.action !== "approve" || e.toLowerCase() !== input.actorEmail.toLowerCase());
  const label = final ? "Fully approved" : LABELS[input.action];
  const heading = input.action === "approve" && !final ? "Awaiting your approval" : label;
  const lines = [
    `ENFA No: ${input.enfaNo}`,
    input.context.subject ? `Subject: ${input.context.subject}` : "",
    `Action: ${label}`,
    `By: ${input.actor}`,
    input.comment ? `Comment: ${input.comment}` : "",
  ].filter(Boolean);
  return { people, final, to, subject: `ENFA ${input.enfaNo} — ${heading}`, text: `${heading}\n\n${lines.join("\n")}\n` };
}
