import mammoth from "mammoth/mammoth.browser";
import { supabase } from "@/integrations/supabase/client";

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const PDF_MIME = "application/pdf";

export interface WorkingDocumentInfo {
  version: number;
  filename: string;
  storagePath: string;
  updatedAt: string;
}

export interface EmbeddedDocxImage {
  id: string;
  base64: string;
  width: number;
  height: number;
}

const MAX_DOCX_IMAGES = 30;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 680;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("An image in Detailed Description could not be read"));
    image.src = url;
  });
}

/** Resolves every HTML image to PNG bytes so the DOCX never depends on a URL. */
export async function embedDescriptionImages(html: string): Promise<{
  html: string;
  images: EmbeddedDocxImage[];
}> {
  if (!html || typeof DOMParser === "undefined") return { html, images: [] };
  const parsed = new DOMParser().parseFromString(`<main>${html}</main>`, "text/html");
  const main = parsed.querySelector("main");
  if (!main) return { html, images: [] };
  const elements = Array.from(main.querySelectorAll("img"));
  if (elements.length > MAX_DOCX_IMAGES) throw new Error(`Detailed Description can contain up to ${MAX_DOCX_IMAGES} images`);

  const images: EmbeddedDocxImage[] = [];
  for (const [index, element] of elements.entries()) {
    const source = element.getAttribute("src")?.trim();
    if (!source) throw new Error(`Image ${index + 1} in Detailed Description has no source`);
    let blob: Blob;
    try {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      blob = await response.blob();
    } catch {
      throw new Error(`Image ${index + 1} could not be loaded for the Word document`);
    }
    if (!blob.type.startsWith("image/")) throw new Error(`Image ${index + 1} is not a supported image file`);
    if (blob.size > MAX_IMAGE_BYTES) throw new Error(`Image ${index + 1} exceeds 6 MB`);

    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await loadImage(objectUrl);
      const naturalWidth = Math.max(1, image.naturalWidth || image.width);
      const naturalHeight = Math.max(1, image.naturalHeight || image.height);
      const requestedWidth = Number.parseFloat(element.getAttribute("width") ?? element.style.width) || naturalWidth;
      const explicitHeight = Number.parseFloat(element.getAttribute("height") ?? element.style.height);
      const requestedHeight = explicitHeight || naturalHeight * (requestedWidth / naturalWidth);
      const scale = Math.min(1, MAX_IMAGE_WIDTH / requestedWidth);
      const width = Math.max(1, Math.round(requestedWidth * scale));
      const height = Math.max(1, Math.round(requestedHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = naturalWidth;
      canvas.height = naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image conversion is unavailable in this browser");
      context.drawImage(image, 0, 0, naturalWidth, naturalHeight);
      const base64 = canvas.toDataURL("image/png").split(",")[1];
      if (!base64) throw new Error("Image conversion failed");
      const id = `image-${index + 1}`;
      images.push({ id, base64, width, height });
      element.setAttribute("src", `enfa-embedded:${id}`);
      element.setAttribute("width", String(width));
      element.setAttribute("height", String(height));
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  return { html: main.innerHTML, images };
}

function base64ToBlob(base64: string): Blob {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: DOCX_MIME });
}

async function nextDocumentVersion(enfaNumber: string): Promise<number> {
  const { data: current, error } = await supabase
    .from("enfa_working_document")
    .select("version")
    .eq("enfa_number", enfaNumber)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (current?.version ?? 0) + 1;
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
  const version = await nextDocumentVersion(input.enfaNumber);
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

export async function saveFinalPdf(input: {
  enfaNumber: string;
  userId: string;
  blob: Blob;
}): Promise<WorkingDocumentInfo> {
  const version = await nextDocumentVersion(input.enfaNumber);
  const safe = input.enfaNumber.replace(/[^A-Za-z0-9_-]/g, "-");
  const storagePath = `${input.userId}/${safe}/final-v${version}.pdf`;
  const filename = `ENFA-${input.enfaNumber}-final.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("enfa-working-documents")
    .upload(storagePath, input.blob, { contentType: PDF_MIME, upsert: false });
  if (uploadError) throw uploadError;
  await supabase.from("enfa_working_document").update({ state: "superseded" }).eq("enfa_number", input.enfaNumber).eq("state", "final");
  const { data, error } = await supabase.from("enfa_working_document").insert({
    enfa_number: input.enfaNumber,
    version,
    storage_path: storagePath,
    filename,
    mime_type: PDF_MIME,
    size_bytes: input.blob.size,
    state: "final",
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
  const paragraphs = Array.from(main.querySelectorAll("p"));
  const start = paragraphs.find((element) => element.textContent?.trim().toUpperCase() === "DETAILED DESCRIPTION");
  const end = paragraphs.find((element) => element.textContent?.trim().toUpperCase() === "APPROVALS");
  if (!start || !end || !(start.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING)) {
    throw new Error("The Detailed Description section was not found in this DOCX");
  }
  const range = parsed.createRange();
  range.setStartAfter(start);
  range.setEndBefore(end);
  const holder = parsed.createElement("div");
  holder.append(range.cloneContents());
  const html = holder.innerHTML.trim();
  if (!html || !holder.textContent?.trim()) throw new Error("Detailed Description cannot be empty");
  return html;
}