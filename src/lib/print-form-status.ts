/** Only the record's overall status decides completion, never one approval level. */
export function printFormStatusLabel(status: string | undefined): "DRAFT" | "APPROVED" {
  const normalized = status?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  return ["completed", "closed", "final", "approved", "finally_approved", "final_approved"].includes(normalized)
    ? "APPROVED" : "DRAFT";
}

export function readPrintFormStatus(row: Record<string, unknown>): string {
  for (const alias of ["STATUS_TXT", "STATUS", "ENFA_STATUS"]) {
    const entry = Object.entries(row).find(([key]) => key.trim().toUpperCase() === alias);
    if (entry?.[1] != null && String(entry[1]).trim()) return String(entry[1]).trim();
  }
  return "";
}