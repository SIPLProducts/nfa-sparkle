import { supabase } from "@/integrations/supabase/client";

export type EnfaPreviewVariant = "edit" | "report";

export interface EnfaPreviewPdf {
  bytes: Uint8Array;
  blob: Blob;
  filename: string;
}

interface EnfaPrintResponse {
  base64?: string;
  mime?: string;
  filename?: string;
  error?: string;
}

/** Loads the authoritative PDF returned by the configured Preview service. */
export async function fetchEnfaPreviewPdf(
  enfaNumber: string,
  variant: EnfaPreviewVariant = "report",
  signal?: AbortSignal,
): Promise<EnfaPreviewPdf> {
  const normalizedNumber = enfaNumber.trim();
  if (!normalizedNumber) throw new Error("An eNFA number is required to download the PDF");

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  if (!token) throw new Error("Your session has expired. Please sign in again.");

  const response = await fetch("/api/public/enfa-print", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      PRINT: { EFNA_NO: normalizedNumber },
      ...(variant === "edit" ? { variant: "edit" } : {}),
    }),
    signal,
  });
  const result = (await response.json().catch(() => ({}))) as EnfaPrintResponse;
  if (!response.ok || !result.base64) {
    throw new Error(result.error || `Preview PDF download failed (HTTP ${response.status})`);
  }

  const binary = atob(result.base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const blob = new Blob([bytes.slice()], { type: result.mime || "application/pdf" });
  return {
    bytes,
    blob,
    filename: result.filename || `ENFA-${normalizedNumber}.pdf`,
  };
}

export function downloadEnfaPreviewPdf(pdf: EnfaPreviewPdf): void {
  const url = URL.createObjectURL(pdf.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = pdf.filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}