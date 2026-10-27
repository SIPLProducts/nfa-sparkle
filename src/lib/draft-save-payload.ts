/** Fields that existed before the newer draft columns; the Detailed Description must always save with these. */
export const CORE_DRAFT_FIELDS = [
  "enfa_number",
  "subject",
  "scope_impact",
  "budget_impact",
  "timeline_days",
  "detailed_description",
  "updated_by",
] as const;

export function coreDraftPayload(full: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of CORE_DRAFT_FIELDS) if (k in full) out[k] = full[k];
  return out;
}
