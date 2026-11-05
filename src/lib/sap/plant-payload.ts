/**
 * Builds the Plant F4 request body. Starts from the configured template (Admin →
 * SAP API Settings) and fills `cc_code.CC_CODE` with the selected company code,
 * keeping `check` from the template (default "X"). Returns null for invalid JSON.
 */
export function buildPlantF4Payload(template: string | null | undefined, companyCode: string): Record<string, unknown> | null {
  let base: Record<string, unknown> = {};
  const t = (template ?? "").trim();
  if (t) {
    try {
      const parsed = JSON.parse(t);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) base = parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  const innerRaw = base["cc_code"];
  const inner = innerRaw && typeof innerRaw === "object" && !Array.isArray(innerRaw) ? (innerRaw as Record<string, unknown>) : {};
  const check = String(inner["check"] ?? "").trim() || "X";
  return { ...base, cc_code: { ...inner, check, CC_CODE: String(companyCode ?? "").trim() } };
}
