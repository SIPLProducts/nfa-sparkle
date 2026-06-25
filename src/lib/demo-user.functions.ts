import { createServerFn } from "@tanstack/react-start";

export const ensureDemoUser = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = "demo@nfa.local";
  const password = "Demo@12345";

  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === email);

  if (!existing) {
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Demo User" },
    });
    if (error) throw error;
  } else {
    await supabaseAdmin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
  }
  return { email, password };
});