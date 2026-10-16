import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertScreenAccess } from "./user-admin.server";
import type { EmailConfig } from "./workflow-mail.server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const getEmailConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertScreenAccess(context as any, "sap_api");
    const { loadEmailConfig } = await import("./workflow-mail.server");
    return loadEmailConfig();
  });

export const saveEmailConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: EmailConfig & { password?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertScreenAccess(context as any, "sap_api");
    const port = data.port == null ? null : Number(data.port);
    if (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error("Enter a port between 1 and 65535.");
    if (data.fromEmail && !EMAIL_RE.test(data.fromEmail)) throw new Error("Enter a valid From Email.");
    const cc = (data.cc ?? []).map((c) => String(c).trim()).filter((c) => EMAIL_RE.test(c));
    const { storeEmailConfig } = await import("./workflow-mail.server");
    await storeEmailConfig({
      enabled: Boolean(data.enabled),
      host: String(data.host ?? "").trim(),
      port,
      encryption: (["tls", "ssl", "none"].includes(data.encryption) ? data.encryption : "") as EmailConfig["encryption"],
      username: String(data.username ?? "").trim(),
      fromEmail: String(data.fromEmail ?? "").trim(),
      fromName: String(data.fromName ?? "").trim(),
      cc,
    }, data.password || undefined);
    return { ok: true };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { to: string }) => d)
  .handler(async ({ data, context }) => {
    await assertScreenAccess(context as any, "sap_api");
    if (!EMAIL_RE.test(data.to ?? "")) throw new Error("Enter a valid email address.");
    const { sendTestMail } = await import("./workflow-mail.server");
    try {
      await sendTestMail(data.to.trim());
      return { ok: true, message: "Test email sent" };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? "Test email failed" };
    }
  });
