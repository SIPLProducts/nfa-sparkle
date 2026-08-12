import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Role = "initiator" | "approver" | "admin" | "viewer";

export interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  roles: Role[];
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface RolePermissionRow {
  role: Role;
  screen: string;
  allowed: boolean;
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin role required");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await assertAdmin(context as any);
    const db = await admin();
    const { data: list, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    const ids: string[] = list.users.map((u: any) => u.id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      db.from("profiles").select("id, full_name, email, is_active").in("id", ids),
      db.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);
    const pmap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));
    const rmap = new Map<string, Role[]>();
    for (const r of roles ?? []) {
      const arr = rmap.get(r.user_id) ?? [];
      arr.push(r.role);
      rmap.set(r.user_id, arr);
    }
    return list.users
      .map((u: any) => {
        const p = pmap.get(u.id);
        return {
          id: u.id,
          email: u.email ?? p?.email ?? "",
          full_name: p?.full_name ?? (u.user_metadata?.full_name as string) ?? "",
          roles: rmap.get(u.id) ?? [],
          is_active: p?.is_active !== false && !u.banned_until,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        } as ManagedUser;
      })
      .sort((a: ManagedUser, b: ManagedUser) => (a.created_at < b.created_at ? 1 : -1));
  });

async function applyRoles(db: any, userId: string, roles: Role[]) {
  await db.from("user_roles").delete().eq("user_id", userId);
  if (roles.length) {
    await db.from("user_roles").insert(roles.map((role) => ({ user_id: userId, role })));
  }
}

export const createManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; full_name: string; roles: Role[] }) => {
    if (!d.email?.trim()) throw new Error("Email is required");
    if (!d.password || d.password.length < 8) throw new Error("Password must be at least 8 characters");
    if (!d.full_name?.trim()) throw new Error("Full name is required");
    if (!d.roles?.length) throw new Error("Select at least one role");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { data: created, error } = await db.auth.admin.createUser({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name.trim() },
    });
    if (error) throw new Error(error.message);
    const id = created.user.id;
    await db
      .from("profiles")
      .upsert({ id, email: data.email.trim().toLowerCase(), full_name: data.full_name.trim() });
    await applyRoles(db, id, data.roles);
    return { id };
  });

export const updateManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; full_name: string; roles: Role[] }) => {
    if (!d.full_name?.trim()) throw new Error("Full name is required");
    if (!d.roles?.length) throw new Error("Select at least one role");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    if (data.id === context.userId && !data.roles.includes("admin")) {
      throw new Error("You cannot remove your own admin role");
    }
    await db.from("profiles").update({ full_name: data.full_name.trim() }).eq("id", data.id);
    await db.auth.admin.updateUserById(data.id, { user_metadata: { full_name: data.full_name.trim() } });
    await applyRoles(db, data.id, data.roles);
    return { ok: true };
  });

export const resetManagedUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; password: string }) => {
    if (!d.password || d.password.length < 8) throw new Error("Password must be at least 8 characters");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { error } = await db.auth.admin.updateUserById(data.id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setManagedUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    if (data.id === context.userId && !data.active) throw new Error("You cannot deactivate your own account");
    const db = await admin();
    const { error } = await db.auth.admin.updateUserById(data.id, {
      ban_duration: data.active ? "none" : "876000h",
    });
    if (error) throw new Error(error.message);
    await db.from("profiles").update({ is_active: data.active }).eq("id", data.id);
    return { ok: true };
  });

export const listRolePermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RolePermissionRow[]> => {
    const { data, error } = await context.supabase.from("role_permission").select("role, screen, allowed");
    if (error) throw error;
    return (data ?? []) as RolePermissionRow[];
  });

export const saveRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rows: RolePermissionRow[] }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const rows = data.rows.map((r) => ({
      role: r.role,
      screen: r.screen,
      // never let an admin lock every admin out of user management
      allowed: r.role === "admin" && r.screen === "user_management" ? true : r.allowed,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await db.from("role_permission").upsert(rows, { onConflict: "role,screen" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });