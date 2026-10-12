/** Resolve runtime Edit identity independently of the SAP connection login. */
export function buildSapEditPayload(template: Record<string, unknown>, edit: Record<string, unknown>, reffld: string) {
  const userName = typeof edit.user_name === "string" ? edit.user_name.trim().toUpperCase() : "";
  if (!userName) throw new Error("Your User ID could not be resolved. Please sign in again or contact your administrator.");
  const number = reffld.trim();
  if (!number) throw new Error("A record number (reffld) is required");
  const savedEdit = template.edit && typeof template.edit === "object" && !Array.isArray(template.edit)
    ? template.edit as Record<string, unknown> : {};
  return { ...template, edit: { ...savedEdit, ...edit, user_name: userName, reffld: number } };
}

export function sapEditField(detail: Record<string, unknown> | null, key: string): string {
  const value = detail?.[key];
  return value === undefined || value === null ? "" : String(value);
}

/** SAP may return a record, a wrapped record, or an initiator-only refusal. */
export function readSapEditPayload(text: string): { record: Record<string, unknown> | null; message: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { record: null, message: null };
  let parsed: unknown;
  try { parsed = JSON.parse(trimmed); }
  catch { return { record: null, message: trimmed.slice(0, 500) }; }
  if (typeof parsed === "string") return { record: null, message: parsed };
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const object = parsed as Record<string, unknown>;
    const message = object.message ?? object.MESSAGE ?? object.error;
    const hasRecordKeys = ["SUBJECT", "TEXT", "CC_TEXT", "PSPNR", "FUNCT", "SCOPE_IMPACT"].some(key => object[key] !== undefined);
    if (!hasRecordKeys && typeof message === "string" && message.trim()) return { record: null, message: message.trim() };
    for (const key of ["data", "body", "result", "response"]) {
      if (object[key] !== undefined) { parsed = object[key]; break; }
    }
  }
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return { record: null, message: null }; }
  }
  if (Array.isArray(parsed)) parsed = parsed[0];
  return { record: parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null, message: null };
}