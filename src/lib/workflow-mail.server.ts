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
  /** Initiator identifiers (User ID, name or email); any may match. */
  initiator?: string | string[];
  /** Approver identifiers by level (User ID, name or email); any may match. */
  approvers?: Array<string | string[]>;
  /** Level the acting approver is at (1-based). */
  level?: number;
}

/** Picks recipients by action: pure, so it can be tested. */
const ids = (v: string | string[] | undefined): string[] =>
  Array.from(new Set((Array.isArray(v) ? v : [v ?? ""]).map((x) => String(x ?? "").trim()).filter(Boolean)));

export function pickRecipients(action: WorkflowAction, ctx: WorkflowNotifyContext): { people: string[]; final: boolean } {
  const approvers = (ctx.approvers ?? []).map(ids);
  const total = approvers.reduce((last, a, i) => (a.length ? i + 1 : last), 0);
  const level = Math.max(1, ctx.level ?? 1);
  const initiator = ids(ctx.initiator);
  if (action === "approve") {
    // Without a known chain we cannot tell "next approver" from "final"; never guess.
    if (!total) return { people: [], final: false };
    if (level >= total) return { people: initiator, final: true };
    // Next configured approver after the acting level (skips empty slots).
    const next = approvers.slice(level).find((a) => a.length) ?? [];
    return { people: next, final: false };
  }
  if (action === "clarification") return { people: [...initiator, ...approvers.slice(0, level).flat()], final: false };
  return { people: initiator, final: false };
}

/** Level of the acting approver: the chain level holding their User ID, else the fallback. Pure. */
export function actingLevel(chainIds: string[], actor: string, fallback: number): number {
  const a = actor.trim().toUpperCase();
  const i = a ? chainIds.findIndex((id) => (id ?? "").trim().toUpperCase() === a) : -1;
  return i >= 0 ? i + 1 : Math.max(1, fallback || 1);
}

/**
 * Builds the recipient context on the server from SAP, after SAP accepted the action.
 * SAP's record Select only answers for the initiator, so it is tried as each portal user
 * (hint first) until SAP returns the record's INIT_USERID; that detail also gives the
 * plant / NFA type / function used to read the record's approval flow.
 */
export async function resolveWorkflowContext(input: {
  enfaNo: string; actorUserId: string; hint: WorkflowNotifyContext;
}): Promise<{ context: WorkflowNotifyContext; source: string }> {
  const hint = input.hint;
  const src: string[] = [];
  let initiator: string[] = ids(hint.initiator);
  let chainIds: string[] = [];
  try {
    const { callEnfaSelect, callSapApprovalFlow } = await import("@/lib/sap-report.server");
    const { parseSapApprovalFlow } = await import("@/lib/sap-approval-flow");
    const db = await admin();
    const { data: profs } = await db.from("profiles").select("username, status");
    const all = ((profs ?? []) as Array<{ username: string | null; status: string | null }>)
      .filter((p) => p.username && String(p.status ?? "").toUpperCase() !== "DELETED")
      .map((p) => p.username!.trim().toUpperCase());
    const candidates = Array.from(new Set([...initiator.map((x) => x.toUpperCase()), ...all]))
      .filter((u) => u && u !== input.actorUserId.trim().toUpperCase());
    // The actor may also be the initiator; try them last.
    if (input.actorUserId.trim()) candidates.push(input.actorUserId.trim().toUpperCase());
    let detail: Record<string, unknown> | null = null;
    for (let i = 0; i < candidates.length && !detail; i += 6) {
      const batch = await Promise.all(candidates.slice(i, i + 6).map(async (u) => {
        try {
          const r = await callEnfaSelect(input.enfaNo, { user_name: u });
          const parsed = r.ok ? JSON.parse(r.body || "null") : null;
          const d = Array.isArray(parsed) ? parsed[0] : parsed;
          return d && typeof d === "object" && String((d as any).INIT_USERID ?? "").trim() ? d as Record<string, unknown> : null;
        } catch { return null; }
      }));
      detail = batch.find(Boolean) ?? null;
    }
    if (detail) {
      initiator = ids([String(detail.INIT_USERID ?? ""), ...initiator]);
      src.push("initiator:sap");
      const plant = String(detail.PSPNR ?? "").trim();
      const nfaType = String(detail.FUNCT ?? detail.FUNCT_TXT ?? "").trim();
      const functionName = String(detail.EXTR_TXT ?? detail.EXTRA_TXT ?? detail.EXTRA ?? "").trim();
      if (plant && nfaType && functionName) {
        const f = await callSapApprovalFlow({ plant, nfaType, functionName });
        if (f.ok) {
          for (const a of parseSapApprovalFlow(f.body)) {
            const lv = Number(a.level);
            if (lv >= 1 && lv <= 7) chainIds[lv - 1] = (a.userId ?? "").trim();
          }
          if (chainIds.some(Boolean)) src.push("chain:sap");
        }
      }
    } else if (initiator.length) src.push("initiator:screen");
  } catch (e) {
    console.warn("[workflow-mail] SAP context lookup failed:", (e as Error)?.message ?? e);
  }
  const hintApprovers = (hint.approvers ?? []).map(ids);
  const approvers = Array.from({ length: 7 }, (_, i) => ids([chainIds[i] ?? "", ...(hintApprovers[i] ?? [])]));
  if (!src.some((s) => s.startsWith("chain")) && hintApprovers.some((a) => a.length)) src.push("chain:screen");
  const level = actingLevel(Array.from({ length: 7 }, (_, i) => chainIds[i] ?? ""), input.actorUserId, hint.level ?? 1);
  return { context: { subject: hint.subject, initiator, approvers, level }, source: src.join(",") || "none" };
}

type MailProfile = { username: string | null; full_name: string | null; email: string | null; status: string | null };

/** Matches identifiers to Email IDs: exact User ID / name / email first, then a name that matches exactly one user. Pure, so it can be tested. */
export function matchEmails(identifiers: string[], profiles: MailProfile[]): string[] {
  const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const wanted = Array.from(new Set(identifiers.map(norm).filter(Boolean)));
  const live = profiles.filter((p) => p.email && String(p.status ?? "").toUpperCase() !== "DELETED");
  const out = new Set<string>();
  for (const w of wanted) {
    const exact = live.filter((p) => [p.username, p.full_name, p.email].map(norm).includes(w));
    if (exact.length) { exact.forEach((p) => out.add(p.email!.trim())); continue; }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(w)) { out.add(w); continue; }
    // SAP names may be partial (e.g. first name only); use only when unambiguous.
    const tokens = w.split(" ").filter((t) => t.length >= 3);
    if (!tokens.length || /\d/.test(w)) continue;
    const loose = live.filter((p) => { const n = norm(p.full_name).split(" "); return tokens.every((t) => n.includes(t)); });
    if (new Set(loose.map((p) => p.email!.toLowerCase())).size === 1) out.add(loose[0].email!.trim());
  }
  return Array.from(new Set(out));
}

async function resolveEmails(identifiers: string[]): Promise<string[]> {
  if (!identifiers.some((v) => v.trim())) return [];
  const db = await admin();
  const { data } = await db.from("profiles").select("username, full_name, email, status");
  return matchEmails(identifiers, (data ?? []) as MailProfile[]);
}

const LABELS: Record<WorkflowAction, string> = {
  approve: "Approved",
  reject: "Rejected",
  back_to_initiator: "Sent back to initiator",
  clarification: "Clarification requested",
};

export async function notifyWorkflowAction(raw: {
  action: WorkflowAction;
  enfaNo: string;
  comment: string;
  actor: string;
  actorEmail: string;
  /** Signed-in approver's User ID (profiles.username). */
  actorUserId?: string;
  context: WorkflowNotifyContext;
}) {
  const { config } = await loadEmailConfig();
  const resolved = await resolveWorkflowContext({ enfaNo: raw.enfaNo, actorUserId: raw.actorUserId ?? "", hint: raw.context });
  const input = { ...raw, context: resolved.context };
  const mail = await buildWorkflowMail(input);
  const record = async (status: string, error?: string) => {
    try {
      const db = await admin();
      await db.from("email_log").insert({
        enfa_no: input.enfaNo, action: mail.final ? "final_approve" : input.action, status,
        people: mail.people, recipients: mail.to, error: error ?? null,
        level: input.context.level ?? null, source: resolved.source,
      });
    } catch { /* logging never blocks */ }
  };
  if (!config.enabled) {
    console.info(`[workflow-mail] ${input.enfaNo} ${input.action}: sending disabled`);
    await record("skipped", "Sending is switched off in Email Configuration");
    return;
  }
  if (!mail.to.length) {
    const noChain = input.action === "approve" && !(input.context.approvers ?? []).some((a) => ids(a).length);
    const reason = noChain
      ? "Approval chain not available from SAP for this record"
      : !mail.people.length
        ? "Initiator could not be read from SAP for this record"
        : `No Email ID found in User Management for: ${mail.people.join(", ")}`;
    console.warn(`[workflow-mail] ${input.enfaNo} ${input.action}: ${reason}`);
    await record("skipped", reason);
    return;
  }
  try {
    const { transporter, from } = await transport();
    await transporter.sendMail({ from, to: mail.to, cc: config.cc.length ? config.cc : undefined, subject: mail.subject, text: mail.text });
    console.info(`[workflow-mail] ${input.enfaNo} ${input.action}: sent to ${mail.to.join(", ")}`);
    await record("sent");
  } catch (e) {
    const msg = friendlyMailError(e);
    console.warn(`[workflow-mail] ${input.enfaNo} ${input.action}: failed — ${msg}`);
    await record("failed", msg);
  }
}

export async function listEmailLog(limit = 20) {
  const db = await admin();
  const { data } = await db.from("email_log").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as Array<{ id: string; created_at: string; enfa_no: string; action: string; status: string; people: string[]; recipients: string[]; error: string | null }>;
}

/** Works out recipients and text without sending (used for dry-run checks). */
export async function buildWorkflowMail(input: {
  action: WorkflowAction; enfaNo: string; comment: string; actor: string; actorEmail: string; context: WorkflowNotifyContext;
}) {
  const { people, final } = pickRecipients(input.action, input.context);
  const to = (await resolveEmails(people)).filter((e) => input.action !== "approve" || final || e.toLowerCase() !== input.actorEmail.toLowerCase());
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
