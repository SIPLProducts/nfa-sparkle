export type AdminContext = { supabase: any; userId: string };
export type SystemRole = "initiator" | "approver" | "admin" | "viewer";

const SYSTEM_ROLE_KEYS: SystemRole[] = ["initiator", "approver", "admin", "viewer"];

export function isSystemRole(k: string): k is SystemRole {
  return (SYSTEM_ROLE_KEYS as string[]).includes(k);
}

export async function assertAdmin(ctx: AdminContext) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin role required");
}

export async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function normalizeContact(raw?: string) {
  const c = (raw ?? "").trim();
  if (!c) throw new Error("Contact is required");
  if (!/^\d{10}$/.test(c)) throw new Error("Contact must be 10 digits");
  return c;
}

export function normalizeStatus(raw?: string) {
  const s = (raw ?? "ACTIVE").trim().toUpperCase();
  if (s !== "ACTIVE" && s !== "INACTIVE") throw new Error("Status must be ACTIVE or INACTIVE");
  return s;
}

export function normalizeUsername(raw: string) {
  const u = (raw ?? "").trim();
  if (!u) throw new Error("User ID is required");
  if (u.length < 3 || u.length > 12) throw new Error("User ID must be 3-12 characters");
  if (!/^[A-Za-z0-9._-]+$/.test(u)) {
    throw new Error("User ID may only contain letters, numbers, dot, underscore or hyphen");
  }
  return u;
}

export async function assertUsernameFree(db: any, username: string, exceptId?: string) {
  const { data } = await db.from("profiles").select("id").ilike("username", username);
  const clash = (data ?? []).find((r: any) => r.id !== exceptId);
  if (clash) throw new Error("That User ID is already taken");
}

export async function applyRoles(db: any, userId: string, roles: string[]) {
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

export function parseRoleKeys(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
}