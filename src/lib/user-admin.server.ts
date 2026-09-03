export type AdminContext = { supabase: any; userId: string };
export type SystemRole = "initiator" | "approver" | "admin" | "viewer";

export interface CreateManagedUserInput {
  USER_ID: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  EMAIL: string;
  STATUS: string;
  CONTACT: string;
  PASSWORD: string;
  CONFPWRD: string;
  ROLE: string;
  EMP_ID: string;
  COMPANY_CODE?: string;
  DEPT: string;
}

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

function validateCreateManagedUserInput(raw: CreateManagedUserInput): CreateManagedUserInput {
  const data = { ...raw };
  if (!data.EMAIL?.trim()) throw new Error("Email is required");
  data.USER_ID = normalizeUsername(data.USER_ID);
  data.CONTACT = normalizeContact(data.CONTACT);
  data.STATUS = normalizeStatus(data.STATUS);
  if (!data.PASSWORD || data.PASSWORD.length < 8 || data.PASSWORD.length > 10) {
    throw new Error("Password must be 8-10 characters");
  }
  if (data.PASSWORD !== data.CONFPWRD) throw new Error("Passwords do not match");
  if (!data.FIRST_NAME?.trim()) throw new Error("First name is required");
  if (!data.LAST_NAME?.trim()) throw new Error("Last name is required");
  if (!parseRoleKeys(data.ROLE).length) throw new Error("Select at least one role");
  return data;
}

export async function createManagedUserForAdmin(ctx: AdminContext, raw: CreateManagedUserInput) {
  await assertAdmin(ctx);
  const data = validateCreateManagedUserInput(raw);
  const db = await getAdminClient();
  await assertUsernameFree(db, data.USER_ID);
  const firstName = data.FIRST_NAME.trim();
  const lastName = data.LAST_NAME.trim();
  const fullName = `${firstName} ${lastName}`;
  const email = data.EMAIL.trim().toLowerCase();
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: data.PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(error.message);
  const id = created.user.id;
  await db.from("profiles").upsert({
    id,
    email,
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    username: data.USER_ID,
    employee_id: data.EMP_ID?.trim() || null,
    company_code: data.COMPANY_CODE?.trim() || null,
    department: data.DEPT?.trim() || null,
    contact: data.CONTACT || null,
    status: data.STATUS,
    is_active: data.STATUS === "ACTIVE",
  });
  if (data.STATUS !== "ACTIVE") {
    await db.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  }
  await applyRoles(db, id, parseRoleKeys(data.ROLE));
  return { id };
}