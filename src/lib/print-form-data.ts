import { supabase } from "@/integrations/supabase/client";
import type { EnfaDocumentComment } from "@/components/document/EnfaDocument";

/** Reads an approver user id from a SAP row when the service supplies one. */
export function sapApproverUserId(row: Record<string, unknown> | null | undefined, n: number): string {
  if (!row) return "";
  for (const key of [`USER${n}`, `USRID${n}`, `UID${n}`, `PERNR${n}`, `EMPID${n}`]) {
    const v = row[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

/**
 * Current-version approval remarks for the Print Form, taken from the local
 * record. Returns an empty list when the record has no stored comments.
 */
export async function loadPrintComments(enfaNumber: string): Promise<EnfaDocumentComment[]> {
  if (!enfaNumber) return [];
  try {
    const { data: rec } = await supabase
      .from("nfa")
      .select("id")
      .eq("enfa_number", enfaNumber)
      .maybeSingle();
    if (!rec?.id) return [];
    const { data: rows } = await supabase
      .from("nfa_approver")
      .select("designation, comment, level")
      .eq("nfa_id", rec.id)
      .order("level", { ascending: true });
    return (rows ?? [])
      .filter((r) => (r.comment ?? "").trim())
      .map((r) => ({ name: r.designation ?? "", text: (r.comment ?? "").trim() }));
  } catch {
    return [];
  }
}
