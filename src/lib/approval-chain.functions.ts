import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ChainLevel {
  level: number;
  approver_id: string;
  approver_name: string;
  approver_email: string;
  designation: string | null;
}

export interface ApprovalChain {
  id: string;
  name: string;
  owner_user_id: string | null;
  owner_name: string | null;
  role_key: string | null;
  is_active: boolean;
  levels: ChainLevel[];
  created_at: string;
}

export interface ChainLevelInput {
  approver_id: string;
  designation?: string | null;
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

export const listApprovalChains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApprovalChain[]> => {
    await assertAdmin(context as any);
    const db = await admin();
    const [{ data: chains, error }, { data: levels }, { data: profiles }] = await Promise.all([
      db.from("approval_chain").select("*").order("created_at", { ascending: false }),
      db.from("approval_chain_level").select("*").order("level"),
      db.from("profiles").select("id, full_name, email"),
    ]);
    if (error) throw new Error(error.message);
    const pmap = new Map<string, { full_name: string | null; email: string | null }>(
      (profiles ?? []).map((p: any) => [p.id, p]),
    );
    return (chains ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      owner_user_id: c.owner_user_id,
      owner_name: c.owner_user_id
        ? (pmap.get(c.owner_user_id)?.full_name ?? pmap.get(c.owner_user_id)?.email ?? null)
        : null,
      role_key: c.role_key,
      is_active: c.is_active,
      created_at: c.created_at,
      levels: (levels ?? [])
        .filter((l: any) => l.chain_id === c.id)
        .sort((a: any, b: any) => a.level - b.level)
        .map((l: any) => ({
          level: l.level,
          approver_id: l.approver_id,
          approver_name: pmap.get(l.approver_id)?.full_name ?? "",
          approver_email: pmap.get(l.approver_id)?.email ?? "",
          designation: l.designation,
        })),
    }));
  });

export const saveApprovalChain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string | null;
    name: string;
    owner_user_id: string | null;
    role_key: string | null;
    is_active: boolean;
    levels: ChainLevelInput[];
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const name = (data.name ?? "").trim();
    if (!name) throw new Error("Chain name is required");
    const levels = (data.levels ?? []).filter((l) => l.approver_id);
    if (!levels.length) throw new Error("Add at least one approval level");
    const seen = new Set<string>();
    for (const l of levels) {
      if (seen.has(l.approver_id)) throw new Error("The same approver cannot appear on two levels");
      seen.add(l.approver_id);
    }

    const db = await admin();
    let chainId = data.id ?? null;
    const row = {
      name,
      owner_user_id: data.owner_user_id || null,
      role_key: data.role_key || null,
      is_active: data.is_active,
    };

    if (chainId) {
      const { error } = await db.from("approval_chain").update(row).eq("id", chainId);
      if (error) throw new Error(error.message);
      await db.from("approval_chain_level").delete().eq("chain_id", chainId);
    } else {
      const { data: created, error } = await db
        .from("approval_chain")
        .insert({ ...row, created_by: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      chainId = created.id as string;
    }

    const { error: lErr } = await db.from("approval_chain_level").insert(
      levels.map((l, i) => ({
        chain_id: chainId,
        level: i + 1,
        approver_id: l.approver_id,
        designation: (l.designation ?? "").trim() || null,
      })),
    );
    if (lErr) throw new Error(lErr.message);
    return { id: chainId };
  });

export const setApprovalChainActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; is_active: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { error } = await db.from("approval_chain").update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteApprovalChain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const db = await admin();
    const { error } = await db.from("approval_chain").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
