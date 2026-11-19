/** Branded, responsive (table-based, inline styles) welcome email for new portal users. */
export interface WelcomeEmailInput {
  name: string;
  userId: string;
  email: string;
  link: string;
  portalUrl: string;
  sender: string;
}

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function welcomeEmailSubject(): string {
  return "Welcome to Anumati – Set your ENFA Portal password";
}

export function buildWelcomeEmailHtml(i: WelcomeEmailInput): string {
  const base = i.portalUrl.replace(/\/+$/, "");
  const logo = base ? `${base}/ramky-logo-hd.png` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to Anumati</title>
<style>@media only screen and (max-width:620px){.card{width:100%!important}.pad{padding:24px 20px!important}.btn a{display:block!important}}</style></head>
<body style="margin:0;padding:0;background:#eef3f8;font-family:'Segoe UI',Arial,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f8;padding:24px 12px"><tr><td align="center">
<table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,63,105,.08)">
<tr><td style="background:#ffffff;padding:20px 32px;border-bottom:4px solid #0077BD" align="left">
${logo ? `<img src="${esc(logo)}" alt="Ramky" height="40" style="display:inline-block;height:40px;border:0;vertical-align:middle">` : ""}
<span style="font-size:22px;font-weight:700;color:#003F69;vertical-align:middle;margin-left:10px">Anumati</span>
<div style="font-size:12px;color:#6b7280;margin-top:4px">ENFA Approval Portal</div></td></tr>
<tr><td style="background:#003F69;padding:28px 32px;color:#ffffff" class="pad">
<div style="font-size:24px;font-weight:700">Welcome to the ENFA Portal</div>
<div style="font-size:14px;opacity:.85;margin-top:6px">Your Anumati account has been created.</div></td></tr>
<tr><td class="pad" style="padding:32px">
<p style="margin:0 0 14px;font-size:15px">Dear ${esc(i.name || "User")},</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6">An account has been created for you on the <b>ENFA Portal (Anumati)</b>. To start using the portal, please set your password using the button below.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f8fc;border:1px solid #d6e6f3;border-radius:8px;margin:0 0 24px">
<tr><td style="padding:14px 18px;font-size:14px"><span style="color:#6b7280">User ID</span><br><b style="font-size:16px;color:#003F69">${esc(i.userId)}</b></td></tr>
<tr><td style="padding:0 18px 14px;font-size:14px"><span style="color:#6b7280">Registered email</span><br><b style="color:#003F69">${esc(i.email)}</b></td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" align="center" class="btn" style="margin:0 auto 24px"><tr><td align="center" style="border-radius:8px;background:#0077BD">
<a href="${esc(i.link)}" style="display:inline-block;padding:14px 36px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px">Set Password</a></td></tr></table>
<p style="margin:0 0 16px;font-size:13px;color:#6b7280;line-height:1.6">After setting your password, sign in with your User ID or email address. This link is personal, can be used once and expires soon.</p>
<p style="margin:0 0 20px;font-size:12px;color:#6b7280;word-break:break-all">If the button does not work, copy this link into your browser:<br><a href="${esc(i.link)}" style="color:#0077BD">${esc(i.link)}</a></p>
<p style="margin:0;font-size:14px">Regards,<br><b>${esc(i.sender)}</b></p></td></tr>
<tr><td style="background:#f8fafc;padding:16px 32px;font-size:11px;color:#9ca3af;text-align:center">This is an automated message from the Anumati ENFA Portal. Please do not reply.</td></tr>
</table></td></tr></table></body></html>`;
}

export function buildWelcomeEmailText(i: WelcomeEmailInput): string {
  return `Dear ${i.name || "User"},\n\nWelcome to the ENFA Portal (Anumati). Your account has been created.\n\nUser ID: ${i.userId}\nEmail: ${i.email}\n\nSet your password here:\n${i.link}\n\nThen sign in with your User ID or email.\n\nRegards,\n${i.sender}\n`;
}
