import { createServerFn } from "@tanstack/react-start";

export interface LoginResolvePayload {
  LOGIN_ID: string;
}

/**
 * Resolves a login identifier (User ID or Email) to the account email
 * used for password sign-in. Case-insensitive on the User ID.
 */
export const resolveLoginId = createServerFn({ method: "POST" })
  .inputValidator((d: LoginResolvePayload) => {
    const id = (d?.LOGIN_ID ?? "").trim();
    if (!id) throw new Error("User ID or Email is required");
    if (id.length > 120) throw new Error("Invalid login");
    return { LOGIN_ID: id };
  })
  .handler(async ({ data }): Promise<{ EMAIL: string | null }> => {
    if (data.LOGIN_ID.includes("@")) return { EMAIL: data.LOGIN_ID.toLowerCase() };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: email } = await (supabaseAdmin as any).rpc("resolve_login_email", {
      _login: data.LOGIN_ID,
    });
    return { EMAIL: (email as string | null) ?? null };
  });
