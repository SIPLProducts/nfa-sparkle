import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertScreenAccess, getAdminClient as admin } from "./user-admin.server";

export type MasterKind = "departments" | "designations" | "companies";

export interface MasterItem {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MasterInput {
  name: string;
  code?: string;
  description?: string;
  is_active?: boolean;
}

function checkKind(kind: string): MasterKind {
  if (kind !== "departments" && kind !== "designations" && kind !== "companies") throw new Error("Invalid list");
  return kind;
}

function friendly(message: string) {
  if (/duplicate|unique/i.test(message)) return "An entry with this name already exists";
  return message;
}

function clean(d: MasterInput) {
  if (!d.name?.trim()) throw new Error("Name is required");
  return {
    name: d.name.trim(),
    code: d.code?.trim() || null,
    description: d.description?.trim() || null,
    is_active: d.is_active ?? true,
  };
}

export const listMasterItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: MasterKind }) => ({ kind: checkKind(d.kind) }))
  .handler(async ({ data, context }): Promise<MasterItem[]> => {
    await assertScreenAccess(context as any, "user_management");
    const db = await admin();
    const { data: rows, error } = await db.from(data.kind).select("*").order(data.kind === "companies" ? "code" : "name");
    if (error) throw new Error(error.message);
    return (rows ?? []) as MasterItem[];
  });

export const createMasterItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: MasterKind; item: MasterInput }) => ({
    kind: checkKind(d.kind),
    item: clean(d.item),
  }))
  .handler(async ({ data, context }) => {
    await assertScreenAccess(context as any, "user_management");
    const db = await admin();
    const { error } = await db.from(data.kind).insert(data.item);
    if (error) throw new Error(friendly(error.message));
    return { ok: true };
  });

export const updateMasterItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: MasterKind; id: string; item: MasterInput }) => ({
    kind: checkKind(d.kind),
    id: d.id,
    item: clean(d.item),
  }))
  .handler(async ({ data, context }) => {
    await assertScreenAccess(context as any, "user_management");
    const db = await admin();
    const { error } = await db.from(data.kind).update(data.item).eq("id", data.id);
    if (error) throw new Error(friendly(error.message));
    return { ok: true };
  });

export const deleteMasterItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: MasterKind; id: string }) => ({ kind: checkKind(d.kind), id: d.id }))
  .handler(async ({ data, context }) => {
    await assertScreenAccess(context as any, "user_management");
    const db = await admin();
    const { error } = await db.from(data.kind).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
