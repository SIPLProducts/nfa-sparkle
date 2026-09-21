import { supabase } from "@/integrations/supabase/client";
import type { EnfaDocumentComment } from "@/components/document/EnfaDocument";
import { parsePrintCommentHistory } from "@/lib/print-comment-history";

/** Reads an approver user id from a SAP row when the service supplies one. */
export function sapApproverUserId(row: Record<string, unknown> | null | undefined, n: number): string {
  if (!row) return "";
  for (const key of [
    `USERID${n}`, `USERID_${n}`, `USER_ID${n}`, `USER_ID_${n}`,
    `USER${n}`, `USER_${n}`, `USRID${n}`, `UID${n}`, `PERNR${n}`, `EMPID${n}`,
  ]) {
    const v = row[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

/**
 * Current-version approval remarks for the Print Form, taken from the local
 * record. Returns an empty list when the record has no stored comments.
 */
async function loadSapPrintCommentHistory(enfaNumber: string): Promise<EnfaDocumentComment[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  if (!token) return [];
  const response = await fetch("/api/public/enfa-print", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ PRINT: { EFNA_NO: enfaNumber } }),
  });
  const result = (await response.json()) as { base64?: string };
  if (!response.ok || !result.base64) return [];

  const binary = atob(result.base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const lines: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    let currentY: number | null = null;
    let currentLine: string[] = [];
    const flush = () => {
      const line = currentLine.join(" ").replace(/\s+/g, " ").trim();
      if (line) lines.push(line);
      currentLine = [];
    };
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (currentY !== null && Math.abs(currentY - y) > 2) flush();
      currentY = y;
      if (item.str.trim()) currentLine.push(item.str.trim());
    }
    flush();
  }
  return parsePrintCommentHistory(lines);
}

export async function loadPrintComments(enfaNumber: string): Promise<EnfaDocumentComment[]> {
  if (!enfaNumber) return [];
  try {
    const sapHistory = await loadSapPrintCommentHistory(enfaNumber);
    if (sapHistory.length) return sapHistory;

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
    // Every approver is listed, like the reference sheet; the remark is shown
    // beside the name when one was entered.
    return (rows ?? []).map((r) => ({
      name: r.designation ?? "",
      text: (r.comment ?? "").trim(),
    }));
  } catch {
    return [];
  }
}

/** Loads the latest rich description saved by the Initiator for the Print Form. */
export async function loadPrintDescription(enfaNumber: string): Promise<string> {
  if (!enfaNumber) return "";
  try {
    const { data } = await supabase
      .from("sap_record_draft")
      .select("detailed_description")
      .eq("enfa_number", enfaNumber)
      .maybeSingle();
    return data?.detailed_description ?? "";
  } catch {
    return "";
  }
}
