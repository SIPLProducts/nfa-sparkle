/**
 * Builds the Plant F4 request body from the configured template (Admin → SAP API
 * Settings). Supports `{ plant: { check, bukrs } }` and the older
 * `{ cc_code: { check, CC_CODE } }` shape. `check` follows the approver mode:
 * Predefined = "X", Dynamic = "". When no mode is given, the template's check
 * (default "X") is kept. Returns null for invalid JSON.
 */
export function buildPlantF4Payload(
  template: string | null | undefined,
  companyCode: string,
  check?: "X" | "",
): Record<string, unknown> | null {
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
  const code = String(companyCode ?? "").trim();
  const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
  const plantInner = obj(base["plant"]);
  if (plantInner) {
    const c = check ?? (String(plantInner["check"] ?? "").trim() || "X");
    return { ...base, plant: { ...plantInner, check: c, bukrs: code } };
  }
  const inner = obj(base["cc_code"]) ?? {};
  const c = check ?? (String(inner["check"] ?? "").trim() || "X");
  return { ...base, cc_code: { ...inner, check: c, CC_CODE: code } };
}
