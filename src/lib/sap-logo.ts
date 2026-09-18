const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function unwrap(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 8; depth += 1) {
    if (typeof current === "string") {
      const trimmed = current.trim();
      if (!trimmed) return "";
      try {
        current = JSON.parse(trimmed);
        continue;
      } catch {
        return trimmed;
      }
    }
    if (current && typeof current === "object" && !Array.isArray(current)) {
      const object = current as Record<string, unknown>;
      const key = Object.keys(object).find((candidate) =>
        ["logo", "data", "body", "result", "response", "image", "base64"].includes(candidate.toLowerCase()),
      );
      if (key) {
        current = object[key];
        continue;
      }
    }
    break;
  }
  return current;
}

export function imageMimeFromBase64(base64: string): string | null {
  if (base64.startsWith("Qk")) return "image/bmp";
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("R0lGOD")) return "image/gif";
  if (base64.startsWith("UklGR")) return "image/webp";
  return null;
}

/** Normalises SAP's quoted or nested Base64 response into an image data URL. */
export function parseSapLogoResponse(body: string): string {
  const value = unwrap(body);
  const raw = typeof value === "string" ? value.trim() : "";
  const dataUrl = raw.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  const base64 = (dataUrl?.[2] ?? raw).replace(/\s+/g, "");
  if (!base64 || base64.length > 8_000_000 || !BASE64_PATTERN.test(base64)) {
    throw new Error("SAP returned an invalid company logo");
  }
  const mime = dataUrl?.[1]?.toLowerCase() ?? imageMimeFromBase64(base64);
  if (!mime) throw new Error("SAP returned an unsupported company logo format");
  return `data:${mime};base64,${base64}`;
}
