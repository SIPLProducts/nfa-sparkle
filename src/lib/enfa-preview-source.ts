/** Only explicit SAP no-document responses permit a lower-priority Preview. */
export function isSapDocumentAbsent(message: string | null | undefined): boolean {
  const value = (message ?? "").trim().replace(/[.!]+$/, "");
  return /^(?:data is not available|no data(?: available| found| is available for the current user)?|no document(?: available| found)?|document (?:not found|is not available)|SAP did not return a document for this eNFA number)$/i.test(value);
}

/** Formatting-only HTML is not DD; images and tables remain meaningful content. */
export function hasPreviewDescription(value: string | null | undefined): boolean {
  if (!value) return false;
  const html = value.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  if (/<(?:img\b[^>]*\bsrc\s*=|table\b)/i.test(html)) return true;
  return Boolean(html.replace(/<[^>]*>/g, "").replace(/&(?:nbsp|#160|#xA0);/gi, " ").trim());
}

export function choosePreviewSource(input: {
  documentAvailable: boolean;
  documentAbsent: boolean;
  description?: string | null;
}): "dms" | "description" | "existing" {
  if (input.documentAvailable) return "dms";
  if (input.documentAbsent && hasPreviewDescription(input.description)) return "description";
  return "existing";
}

export function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70 && bytes[4] === 45;
}