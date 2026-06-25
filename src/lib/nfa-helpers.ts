import { supabase } from "@/integrations/supabase/client";

// Display-name lookup for arbitrary user ids. Email is intentionally NOT
// returned here — it is sensitive and only accessible from the user's own
// profile row via RLS.
export async function fetchProfilesMap(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return {} as Record<string, { full_name: string | null; email: string | null }>;
  const { data } = await supabase.rpc("get_profiles_basic", { _ids: ids });
  const map: Record<string, { full_name: string | null; email: string | null }> = {};
  for (const r of (data ?? []) as Array<{ id: string; full_name: string | null }>) {
    map[r.id] = { full_name: r.full_name, email: null };
  }
  return map;
}

export function nameFor(
  map: Record<string, { full_name: string | null; email: string | null }>,
  id: string | null | undefined,
) {
  if (!id) return "";
  const r = map[id];
  return r?.full_name || r?.email || id.slice(0, 8);
}