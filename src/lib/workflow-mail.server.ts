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

async function transport() {
  const { config } = await loadEmailConfig();
  const password = (await readSecret(PASSWORD_KEY)) ?? "";
  if (!config.host || !config.port || !config.fromEmail) throw new Error("Email configuration is incomplete");
  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.encryption === "ssl",
    requireTLS: config.encryption === "tls",
    ignoreTLS: config.encryption === "none",
    auth: config.username ? { user: config.username, pass: password } : undefined,
  });
  const from = config.fromName ? `"${config.fromName.replace(/"/g, "")}" <${config.fromEmail}>` : config.fromEmail;
  return { transporter, from, config };
}

export async function sendTestMail(to: string) {
  const { transporter, from } = await transport();
  await transporter.sendMail({
    from, to,
    subject: "NFA Portal test email",
    text: "This is a test email from the NFA Portal email configuration.",
  });
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
  if (!config.enabled) return;
  const { people, final } = pickRecipients(input.action, input.context);
  const to = (await resolveEmails(people)).filter((e) => e.toLowerCase() !== input.actorEmail.toLowerCase() || input.action !== "approve");
  if (!to.length) {
    console.warn("[workflow-mail] no recipient email found for", input.enfaNo, input.action);
    return;
  }
  const { transporter, from } = await transport();
  const label = final ? "Fully approved" : LABELS[input.action];
  const heading = input.action === "approve" && !final ? "Awaiting your approval" : label;
  const lines = [
    `ENFA No: ${input.enfaNo}`,
    input.context.subject ? `Subject: ${input.context.subject}` : "",
    `Action: ${label}`,
    `By: ${input.actor}`,
    input.comment ? `Comment: ${input.comment}` : "",
  ].filter(Boolean);
  await transporter.sendMail({
    from,
    to,
    cc: config.cc.length ? config.cc : undefined,
    subject: `ENFA ${input.enfaNo} — ${heading}`,
    text: `${heading}\n\n${lines.join("\n")}\n`,
  });
}
