import mammoth from "mammoth/mammoth.browser";
import { supabase } from "@/integrations/supabase/client";

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface WorkingDocumentInfo {
  version: number;
  filename: string;
  storagePath: string;
  updatedAt: string;
}

function base64ToBlob(base64: string): Blob {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: DOCX_MIME });
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the document"));
    reader.readAsDataURL(file);
  });
}

export async function saveGeneratedDocx(input: {
  enfaNumber: string;
  userId: string;
  base64: string;
  filename: string;
}): Promise<WorkingDocumentInfo> {
  const { data: current } = await supabase
    .from("enfa_working_document")
    .select("version")
    .eq("enfa_number", input.enfaNumber)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (current?.version ?? 0) + 1;
  const safe = input.enfaNumber.replace(/[^A-Za-z0-9_-]/g, "-");
  const storagePath = `${input.userId}/${safe}/v${version}.docx`;
  const blob = base64ToBlob(input.base64);
  const { error: uploadError } = await supabase.storage
    .from("enfa-working-documents")
    .upload(storagePath, blob, { contentType: DOCX_MIME, upsert: false });
  if (uploadError) throw uploadError;
  await supabase.from("enfa_working_document").update({ state: "superseded" }).eq("enfa_number", input.enfaNumber).eq("state", "working");
  const { data, error } = await supabase.from("enfa_working_document").insert({
    enfa_number: input.enfaNumber,
    version,
    storage_path: storagePath,
    filename: input.filename,
    mime_type: DOCX_MIME,
    size_bytes: blob.size,
    state: "working",
    created_by: input.userId,
  }).select("version, filename, storage_path, updated_at").single();
  if (error) throw error;
  return { version: data.version, filename: data.filename, storagePath: data.storage_path, updatedAt: data.updated_at };
}

export async function loadWorkingDocument(enfaNumber: string): Promise<WorkingDocumentInfo | null> {
  const { data } = await supabase
    .from("enfa_working_document")
    .select("version, filename, storage_path, updated_at")
    .eq("enfa_number", enfaNumber)
    .eq("state", "working")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { version: data.version, filename: data.filename, storagePath: data.storage_path, updatedAt: data.updated_at } : null;
}

export async function downloadWorkingDocument(document: WorkingDocumentInfo): Promise<void> {
  const { data, error } = await supabase.storage.from("enfa-working-documents").download(document.storagePath);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = document.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function extractDescriptionFromDocx(file: File, expectedEnfa: string): Promise<string> {
  if (!file.name.toLowerCase().endsWith(".docx") || (file.type && file.type !== DOCX_MIME)) throw new Error("Choose a Microsoft Word .docx file");
  if (file.size > 20 * 1024 * 1024) throw new Error("The DOCX file exceeds 20 MB");
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { includeDefaultStyleMap: true });
  const parsed = new DOMParser().parseFromString(`<main>${result.value}</main>`, "text/html");
  const main = parsed.querySelector("main");
  if (!main || !main.textContent?.includes(expectedEnfa)) throw new Error("This DOCX belongs to a different eNFA record");
  let collecting = false;
  const selected: Element[] = [];
  for (const child of Array.from(main.children)) {
    const text = child.textContent?.trim().toUpperCase() ?? "";
    if (text === "DETAILED DESCRIPTION") { collecting = true; continue; }
    if (text === "APPROVALS") break;
    if (collecting) selected.push(child);
  }
  const html = selected.map((element) => element.outerHTML).join("").trim();
  if (!collecting || !html) throw new Error("The Detailed Description section was not found in this DOCX");
  return html;
}