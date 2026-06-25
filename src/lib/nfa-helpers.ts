import { supabase } from "@/integrations/supabase/client";

export async function fetchProfilesMap(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return {} as Record<string, { full_name: string | null; email: string | null }>;
  const { data } = await supabase.from("profiles").select("id,email,full_name").in("id", ids);
  const map: Record<string, { full_name: string | null; email: string | null }> = {};
  for (const r of data ?? []) map[r.id] = { full_name: r.full_name, email: r.email };
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