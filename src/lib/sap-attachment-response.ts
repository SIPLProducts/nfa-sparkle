interface SapFile {
  filename: string;
  base64: string;
  mime: string;
}

const B64 = /^[A-Za-z0-9+/\r\n=]+$/;

function sniffMime(name: string, base64: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (/\.jpe?g$/.test(n)) return "image/jpeg";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".txt")) return "text/plain";
  if (n.endsWith(".csv")) return "text/csv";
  if (n.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const head = base64.slice(0, 8);
  if (head.startsWith("JVBER")) return "application/pdf";
  if (head.startsWith("iVBOR")) return "image/png";
  if (head.startsWith("/9j/")) return "image/jpeg";
  if (head.startsWith("R0lGOD")) return "image/gif";
  if (head.startsWith("UEsDB")) return "application/zip";
  return "application/octet-stream";
}

/** Accepts SAP FILE_BASE64 and existing attachment content aliases. */
export function extractFiles(raw: string): { files: SapFile[]; message: string | null } {
  const text = (raw ?? "").trim();
  if (!text) return { files: [], message: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { files: [], message: null };
  }

  const files: SapFile[] = [];
  let message: string | null = null;
  const seen = new Set<unknown>();

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const obj = node as Record<string, unknown>;
    const nameKey = Object.keys(obj).find((k) => /^(file_name|filename|name)$/i.test(k));
    const contentKey = Object.keys(obj).find((k) => /^(file_base64|file_content|filecontent|content|file|data)$/i.test(k));
    const content = contentKey ? obj[contentKey] : undefined;
    if (typeof content === "string" && content.trim().length > 50 && B64.test(content.trim())) {
      const base64 = content.replace(/\s+/g, "");
      const filename = String((nameKey ? obj[nameKey] : "") || `document-${files.length + 1}`).trim();
      files.push({ filename, base64, mime: sniffMime(filename, base64) });
      return;
    }
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && /message|msg|error/i.test(k) && v.trim() && !message) message = v.trim();
    }
    for (const v of Object.values(obj)) walk(v);
  };

  walk(parsed);
  return { files, message };
}
