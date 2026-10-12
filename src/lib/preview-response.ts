import { isPdfBytes } from "./enfa-preview-source";

export type PreviewResponse =
  | { source: "sap"; base64: string }
  | { source: "web" }
  | { source: "error"; message: string };

/** Only the explicit SAP selection marker permits the saved web form. */
export function classifyPreviewResponse(raw: string): PreviewResponse {
  let value: unknown = raw.trim();
  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof value === "string") {
      const text = value.trim();
      if (text === "X") return { source: "web" };
      try {
        value = JSON.parse(text);
        continue;
      } catch { /* raw SAP string */ }
      const base64 = text.replace(/\s+/g, "");
      if (/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
        try {
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          if (isPdfBytes(bytes)) return { source: "sap", base64 };
        } catch { /* invalid Base64 */ }
      }
      break;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const envelope = value as Record<string, unknown>;
      if (envelope.ok === false || envelope.error) break;
      const key = ["body", "data", "result", "response", "preview", "base64"].find((key) => key in envelope);
      if (key) { value = envelope[key]; continue; }
    }
    break;
  }
  return { source: "error", message: "SAP returned an unexpected or invalid Preview response. Please try again." };
}