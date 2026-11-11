import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { portalBaseUrl, resetPasswordLink } from "./reset-link";

const GENERIC = "If this account exists, a reset link has been sent to its registered email.";

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d: { login: string }) => {
    const login = String(d?.login ?? "").trim();
    if (!login || login.length > 120) throw new Error("Enter your User ID or Email");
    return { login };
  })
  .handler(async ({ data }): Promise<{ ok: boolean; message: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { loadEmailConfig, sendPasswordResetMail } = await import("./workflow-mail.server");
    const { config } = await loadEmailConfig();
    if (!config.enabled || !config.host || !config.fromEmail)
      return { ok: false, message: "Password reset email is not configured. Contact administrator." };

    let email: string | null = data.login.includes("@") ? data.login.toLowerCase() : null;
    if (!email) {
      const { data: e } = await db.rpc("resolve_login_email", { _login: data.login });
      email = (e as string | null) ?? null;
    }
    if (!email) return { ok: true, message: GENERIC };

    // Throttle: one reset email per address per minute.
    const since = new Date(Date.now() - 60_000).toISOString();
    const { data: recent } = await db.from("email_log").select("id").eq("action", "password_reset").contains("recipients", [email]).gte("created_at", since).limit(1);
    if (recent?.length) return { ok: true, message: GENERIC };

    const { data: link, error } = await db.auth.admin.generateLink({ type: "recovery", email });
    const hashed = link?.properties?.hashed_token;
    if (error || !hashed) return { ok: true, message: GENERIC };

    const base = portalBaseUrl({
      forwardedProto: getRequestHeader("x-forwarded-proto"),
      forwardedHost: getRequestHeader("x-forwarded-host"),
      host: getRequestHeader("host"),
      origin: getRequestHeader("origin"),
    });
    if (!base) return { ok: false, message: "Could not build the reset link. Contact administrator." };

    const { data: prof } = await db.from("profiles").select("full_name").ilike("email", email).limit(1);
    try {
      await sendPasswordResetMail(email, resetPasswordLink(base, hashed), String(prof?.[0]?.full_name ?? ""));
    } catch (e: any) {
      if (e?.message === "NOT_CONFIGURED") return { ok: false, message: "Password reset email is not configured. Contact administrator." };
      console.warn("[password-reset] send failed:", e?.message);
      return { ok: false, message: "The reset email could not be sent. Please try again later or contact administrator." };
    }
    return { ok: true, message: GENERIC };
  });
