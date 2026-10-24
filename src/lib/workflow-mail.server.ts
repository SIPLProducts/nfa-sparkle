import { MAX_APPROVAL_LEVELS } from "@/lib/sap-approval-chain";
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
        let res: Response | null = null;
        try {
          res = await fetch(relayUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-proxy-secret": (secret ?? "").trim(), "ngrok-skip-browser-warning": "1" },
            body: JSON.stringify({ smtp, ...msg, to: Array.isArray(msg.to) ? msg.to : [msg.to] }),
          });
        } catch (e) {
          console.warn("[workflow-mail] relay unreachable, sending directly:", (e as Error)?.message);
        }
        // An older middleware without /mail/send (404) or an unreachable relay falls back to direct SMTP.
        if (res && res.status !== 404) {
          const body = await res.json().catch(() => ({} as any));
          if (!res.ok || !body?.ok) {
            const err: any = new Error(body?.error || `Email relay failed (${res.status})`);
            err.code = body?.code;
            throw err;
          }
          return body;
        }
        if (res) console.warn("[workflow-mail] middleware has no /mail/send; sending directly");
      }
      const nodemailer = (await import("nodemailer")).default;
      const t = nodemailer.createTransport({
        host: smtp.host, port, secure: ssl, ignoreTLS: smtp.ignoreTLS,
        connectionTimeout: 15_000, greetingTimeout: 15_000,
        auth: smtp.user ? { user: smtp.user, pass: password } : undefined,
      });
      const info = await t.sendMail(msg);
      return { ...info, via: "direct" };
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
  const level = Math.max(0, ctx.level ?? 1);
  const initiator = ids(ctx.initiator);
  if (action === "approve") {
    // Without a known chain we cannot tell "next approver" from "final"; never guess.
    if (!total) return { people: [], final: false };
    if (level >= total) return { people: initiator, final: true };
    // Next configured approver after the acting level (skips empty slots).
    const next = approvers.slice(level).find((a) => a.length) ?? [];
    return { people: next, final: false };
  }
  if (action === "clarification") return { people: [...initiator, ...approvers.slice(0, Math.max(0, level - 1)).flat()], final: false };
  return { people: initiator, final: false };
}

/** Level of the acting approver: the chain level holding their User ID, else the fallback. Pure. */
export function actingLevel(chainIds: string[], actor: string, fallback: number, initiator: string[] = []): number {
  const a = actor.trim().toUpperCase();
  const i = a ? chainIds.findIndex((id) => (id ?? "").trim().toUpperCase() === a) : -1;
  if (i >= 0) return i + 1;
  // The initiator is not in the chain: their Approve submits to level 1.
  if (a && initiator.some((x) => x.trim().toUpperCase() === a)) return 0;
  return Math.max(1, fallback || 1);
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
    const { selectRecordAsInitiator } = await import("@/lib/sap-initiator-select");
    const detail = await selectRecordAsInitiator(candidates, (u) => callEnfaSelect(input.enfaNo, { user_name: u }));
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
            if (lv >= 1 && lv <= MAX_APPROVAL_LEVELS) chainIds[lv - 1] = (a.userId ?? "").trim();
          }
          if (chainIds.some(Boolean)) src.push("chain:sap");
        }
      }
    } else if (initiator.length) src.push("initiator:screen");
  } catch (e) {
    console.warn("[workflow-mail] SAP context lookup failed:", (e as Error)?.message ?? e);
  }
  // The approvers the initiator selected at creation are the record's real chain.
  const saved = await loadSavedChain(input.enfaNo);
  if (saved.length) {
    chainIds = saved;
    const i = src.indexOf("chain:sap");
    if (i >= 0) src.splice(i, 1);
    src.push("chain:saved");
  }
  const hintApprovers = saved.length ? [] : (hint.approvers ?? []).map(ids);
  const approvers = Array.from({ length: MAX_APPROVAL_LEVELS }, (_, i) => ids([chainIds[i] ?? "", ...(hintApprovers[i] ?? [])]));
  if (!src.some((s) => s.startsWith("chain")) && hintApprovers.some((a) => a.length)) src.push("chain:screen");
  const level = actingLevel(Array.from({ length: MAX_APPROVAL_LEVELS }, (_, i) => chainIds[i] ?? ""), input.actorUserId, hint.level ?? 1, initiator);
  return { context: { subject: hint.subject, initiator, approvers, level }, source: src.join(",") || "none" };
}

/** User IDs saved per level when the NFA was created ([] when none). Pure parsing in savedChainIds. */
export function savedChainIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_APPROVAL_LEVELS).map((a: any) => String(a?.userId ?? "").trim());
}

async function loadSavedChain(enfaNo: string): Promise<string[]> {
  try {
    const db = await admin();
    const { data } = await db.from("sap_record_draft").select("approvers").eq("enfa_number", enfaNo).maybeSingle();
    const out = savedChainIds(data?.approvers);
    return out.some(Boolean) ? out : [];
  } catch { return []; }
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
    await transporter.sendMail({ from, to: mail.to, cc: config.cc.length ? config.cc : undefined, subject: mail.subject, text: mail.text, html: mail.html });
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
  const to = (await resolveEmails(people)).filter((e) => !((input.action === "approve" && !final) || input.action === "clarification") || e.toLowerCase() !== input.actorEmail.toLowerCase());
  const label = final ? "Fully approved" : LABELS[input.action];
  const heading = input.action === "approve" && !final ? "Awaiting your approval" : label;
  const lines = [
    `ENFA No: ${input.enfaNo}`,
    input.context.subject ? `Subject: ${input.context.subject}` : "",
    `Action: ${label}`,
    `By: ${input.actor}`,
    input.comment ? `Comment: ${input.comment}` : "",
  ].filter(Boolean);
  let greetName = "";
  if (to.length === 1) {
    try {
      const db = await admin();
      const { data } = await db.from("profiles").select("full_name").ilike("email", to[0]).limit(1);
      greetName = String((data as Array<{ full_name: string | null }> | null)?.[0]?.full_name ?? "").trim();
    } catch { /* greeting falls back */ }
  }
  let senderName = "";
  try { senderName = (await loadEmailConfig()).config.fromName ?? ""; } catch { /* fallback */ }
  const html = renderWorkflowMailHtml({
    action: input.action, final, heading, label, enfaNo: input.enfaNo, subject: input.context.subject,
    actor: input.actor, level: input.context.level, comment: input.comment, greetName, date: new Date(), senderName,
  });
  return { people, final, to, subject: `ENFA ${input.enfaNo} — ${heading}`, text: `${heading}\n\n${lines.join("\n")}\n\nRegards,\n${senderLabel(senderName)}\n`, html };
}

/** Signature name: Email Configuration "From Name", else the portal name. */
export const senderLabel = (name?: string) => (name ?? "").trim() || "eNFA Portal";

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const TITLES: Record<WorkflowAction, string> = {
  approve: "Awaiting Your Approval",
  reject: "NFA Rejected",
  back_to_initiator: "Sent Back to Initiator",
  clarification: "Clarification Requested",
};

/** Branded HTML body for workflow emails. Pure, so it can be tested. */
export function renderWorkflowMailHtml(m: {
  action: WorkflowAction; final: boolean; heading: string; label: string; enfaNo: string; subject?: string;
  actor: string; level?: number; comment: string; greetName?: string; date: Date; senderName?: string;
}): string {
  const sender = senderLabel(m.senderName);
  const title = m.final ? "NFA Fully Approved" : TITLES[m.action];
  const no = `<strong>ENFA ${esc(m.enfaNo)}</strong>`;
  const intro = m.final
    ? `We're pleased to inform you that ${no} has been fully approved.`
    : m.action === "approve"
      ? `${no} has been approved at the previous level and is now awaiting your approval.`
      : m.action === "reject"
        ? `${no} has been rejected.`
        : m.action === "back_to_initiator"
          ? `${no} has been sent back to the initiator for revision.`
          : `Clarification has been requested on ${no}.`;
  const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(m.date);
  const dash = "&mdash;";
  const accent = m.final ? "#16a34a"
    : m.action === "approve" ? "#0166a8"
      : m.action === "reject" ? "#dc2626"
        : m.action === "back_to_initiator" ? "#d97706" : "#2563eb";
  const font = "'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
  const commentHtml = m.comment
    ? `<div style="background:#f1f5f9;border-left:3px solid ${accent};padding:8px 12px;border-radius:4px;color:#1e293b">${esc(m.comment)}</div>`
    : dash;
  const rows: Array<[string, string]> = [
    ["ENFA No", `<strong style="font-family:Consolas,Menlo,monospace;color:#0f172a">${esc(m.enfaNo)}</strong>`],
    ["Subject", m.subject ? esc(m.subject) : dash],
    ["Action", esc(m.label)],
    ["Action By", m.actor ? esc(m.actor) : dash],
    ...(m.level ? [["Level", esc(m.level)] as [string, string]] : []),
    ["Comment", commentHtml],
    ["Action Date", `${esc(when)} (IST)`],
  ];
  const rowHtml = rows.map(([k, v], i) =>
    `<tr><td style="padding:12px 0;${i ? "border-top:1px solid #e2e8f0;" : ""}color:#64748b;width:150px;vertical-align:top;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase">${k}</td><td style="padding:12px 0;${i ? "border-top:1px solid #e2e8f0;" : ""}color:#1e293b;font-size:14px">${v}</td></tr>`).join("");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:32px 12px;background:#eef2f7;font-family:${font}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:#0b3a63;background-image:linear-gradient(135deg,#0b3a63,#0166a8);padding:34px 40px 30px">
<div style="color:#bfdbfe;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase">eNFA Portal &middot; Notification</div>
<div style="color:#ffffff;font-size:26px;line-height:1.3;font-weight:700;margin-top:10px">${esc(title)}</div></td></tr>
<tr><td style="height:4px;line-height:4px;font-size:0;background:${accent}">&nbsp;</td></tr>
<tr><td style="padding:34px 40px 8px;color:#334155;font-size:15px;line-height:1.7">
<p style="margin:0 0 14px;color:#0f172a">Dear ${m.greetName ? esc(m.greetName) : "Sir/Madam"},</p>
<p style="margin:0 0 18px"><span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${accent}1a;color:${accent};font-size:12px;font-weight:700;letter-spacing:.5px">${esc(m.label)}</span></p>
<p style="margin:0 0 26px;color:#475569">${intro} The details are summarised below for your review.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
<tr><td style="padding:10px 26px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowHtml}</table></td></tr></table>
<p style="margin:26px 0 0;color:#475569">You can review this NFA in the eNFA Portal.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0 30px"><tr><td style="border-left:3px solid ${accent};padding:2px 0 2px 14px">
<p style="margin:0;color:#475569">Regards,</p>
<p style="margin:4px 0 0;color:#0b3a63;font-weight:700;font-size:16px">${esc(sender)}</p>
<p style="margin:2px 0 0;color:#94a3b8;font-size:12px">eNFA Workflow Notification</p>
</td></tr></table>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 40px;text-align:center;color:#94a3b8;font-size:12px;line-height:1.6">This is an automated notification. Please do not reply.<br>&copy; ${m.date.getFullYear()} ${esc(sender)}. All rights reserved.</td></tr>
</table></td></tr></table></body></html>`;
}
