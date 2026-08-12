import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SystemRole = "initiator" | "approver" | "admin" | "viewer";
export type RoleKey = string;
/** Kept for backwards compatibility with existing imports. */
export type Role = RoleKey;

export const SYSTEM_ROLE_KEYS: SystemRole[] = ["initiator", "approver", "admin", "viewer"];
const isSystemRole = (k: string): k is SystemRole => (SYSTEM_ROLE_KEYS as string[]).includes(k);

export interface RoleDef {
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  user_count: number;
  screen_count: number;
}

export interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  roles: RoleKey[];
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface RolePermissionRow {
  role_key: string;
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

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/* --------------------------------- roles -------------------------------- */

export const listRoleDefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RoleDef[]> => {
    const db = await admin();
    const [{ data: defs }, { data: sysAssign }, { data: customAssign }, { data: perms }] = await Promise.all([
      db.from("app_role_def").select("key, name, description, is_system").order("is_system", { ascending: false }).order("name"),
      db.from("user_roles").select("user_id, role"),
      db.from("user_role_assignment").select("user_id, role_key"),
      db.from("role_permission").select("role_key, allowed"),
    ]);
    void context;
    const counts = new Map<string, number>();
    for (const r of sysAssign ?? []) counts.set(r.role, (counts.get(r.role) ?? 0) + 1);
    for (const r of customAssign ?? []) {
      if (!isSystemRole(r.role_key)) counts.set(r.role_key, (counts.get(r.role_key) ?? 0) + 1);
    }
    const screens = new Map<string, number>();
    for (const p of perms ?? []) {
      if (p.allowed && p.role_key) screens.set(p.role_key, (screens.get(p.role_key) ?? 0) + 1);
    }
    return (defs ?? []).map((d: any) => ({
      key: d.key,
      name: d.name,
      description: d.description,
      is_system: d.is_system,
      user_count: counts.get(d.key) ?? 0,
      screen_count: screens.get(d.key) ?? 0,
    }));
  });

export const createRoleDef = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; description?: string }) => {
    if (!d.name?.trim()) throw new Error("Role name is required");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const key = slugify(data.name);
    if (!key) throw new Error("Role name must contain letters or numbers");
    const { data: existing } = await db.from("app_role_def").select("key").eq("key", key).maybeSingle();
    if (existing) throw new Error("A role with a similar name already exists");
    const { error } = await db.from("app_role_def").insert({
      key,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      is_system: false,
    });
    if (error) throw new Error(error.message);
    return { key };
  });

export const updateRoleDef = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string; name: string; description?: string }) => {
    if (!d.name?.trim()) throw new Error("Role name is required");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { data: row } = await db.from("app_role_def").select("is_system").eq("key", data.key).maybeSingle();
    if (!row) throw new Error("Role not found");
    if (row.is_system) throw new Error("Built-in roles cannot be renamed");
    const { error } = await db
      .from("app_role_def")
      .update({ name: data.name.trim(), description: data.description?.trim() || null })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRoleDef = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { data: row } = await db.from("app_role_def").select("is_system").eq("key", data.key).maybeSingle();
    if (!row) throw new Error("Role not found");
    if (row.is_system) throw new Error("Built-in roles cannot be deleted");
    const { count } = await db
      .from("user_role_assignment")
      .select("id", { count: "exact", head: true })
      .eq("role_key", data.key);
    if ((count ?? 0) > 0) throw new Error("Remove this role from all users before deleting it");
    await db.from("role_permission").delete().eq("role_key", data.key);
    const { error } = await db.from("app_role_def").delete().eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------------- users -------------------------------- */

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await assertAdmin(context as any);
    const db = await admin();
    const { data: list, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    const ids: string[] = list.users.map((u: any) => u.id);
    const [{ data: profiles }, { data: roles }, { data: custom }] = await Promise.all([
      db.from("profiles").select("id, full_name, email, is_active").in("id", ids),
      db.from("user_roles").select("user_id, role").in("user_id", ids),
      db.from("user_role_assignment").select("user_id, role_key").in("user_id", ids),
    ]);
    const pmap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));
    const rmap = new Map<string, RoleKey[]>();
    const push = (uid: string, role: string) => {
      const arr = rmap.get(uid) ?? [];
      if (!arr.includes(role)) arr.push(role);
      rmap.set(uid, arr);
    };
    for (const r of roles ?? []) push(r.user_id, r.role);
    for (const r of custom ?? []) push(r.user_id, r.role_key);
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

async function applyRoles(db: any, userId: string, roles: RoleKey[]) {
  const system = roles.filter(isSystemRole);
  const custom = roles.filter((r) => !isSystemRole(r));
  await db.from("user_roles").delete().eq("user_id", userId);
  if (system.length) {
    await db.from("user_roles").insert(system.map((role) => ({ user_id: userId, role })));
  }
  await db.from("user_role_assignment").delete().eq("user_id", userId);
  if (custom.length) {
    await db.from("user_role_assignment").insert(custom.map((role_key) => ({ user_id: userId, role_key })));
  }
}

export const createManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; full_name: string; roles: RoleKey[] }) => {
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
  .inputValidator((d: { id: string; full_name: string; roles: RoleKey[] }) => {
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

/* ------------------------------ permissions ----------------------------- */

export const listRolePermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RolePermissionRow[]> => {
    const { data, error } = await context.supabase.from("role_permission").select("role_key, screen, allowed");
    if (error) throw error;
    return ((data ?? []) as any[])
      .filter((r) => !!r.role_key)
      .map((r) => ({ role_key: r.role_key as string, screen: r.screen as string, allowed: !!r.allowed }));
  });

export const saveRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rows: RolePermissionRow[] }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const rows = data.rows.map((r) => ({
      role_key: r.role_key,
      // system roles keep the legacy enum column populated
      role: isSystemRole(r.role_key) ? r.role_key : null,
      screen: r.screen,
      // never let an admin lock every admin out of user management
      allowed: r.role_key === "admin" && r.screen === "user_management" ? true : r.allowed,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await db.from("role_permission").upsert(rows, { onConflict: "role_key,screen" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
