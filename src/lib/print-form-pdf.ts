const PDF_PAGE = {
  widthMm: 210,
  heightMm: 297,
  marginMm: 15,
  footerBaselineMm: 289,
  stageWidthPx: 760,
  frameInsetMm: 0.25,
  frameLineWidthMm: 0.35,
  draftFontSizePt: 72,
  draftCenterYmm: 157,
} as const;

function tableWithRows(source: HTMLTableElement, rows: HTMLTableRowElement[]): HTMLTableElement {
  const table = source.cloneNode(false) as HTMLTableElement;
  const body = document.createElement("tbody");
  rows.forEach((row) => body.append(row.cloneNode(true)));
  table.append(body);
  return table;
}

function contentTable(sourceTable: HTMLTableElement, sourceCell: HTMLTableCellElement, child?: Element): HTMLTableElement {
  const row = document.createElement("tr");
  const cell = sourceCell.cloneNode(false) as HTMLTableCellElement;
  const richContent = sourceCell.querySelector<HTMLElement>(".rich-content");
  if (richContent && child) {
    const richClone = richContent.cloneNode(false) as HTMLElement;
    richClone.append(child.cloneNode(true));
    cell.append(richClone);
  } else {
    Array.from(sourceCell.childNodes).forEach((node) => cell.append(node.cloneNode(true)));
  }
  row.append(cell);
  return tableWithRows(sourceTable, [row]);
}

function commentTable(sourceTable: HTMLTableElement, sourceCell: HTMLTableCellElement, block: Element): HTMLTableElement {
  const row = document.createElement("tr");
  const cell = sourceCell.cloneNode(false) as HTMLTableCellElement;
  cell.append(block.cloneNode(true));
  row.append(cell);
  return tableWithRows(sourceTable, [row]);
}

function createPdfBlocks(element: HTMLElement): HTMLElement[] {
  const documentRoot = element.querySelector<HTMLElement>(".enfa-doc");
  if (!documentRoot) return [];
  const tables = Array.from(documentRoot.querySelectorAll<HTMLTableElement>(":scope > .enfa-table"));
  const headerTable = tables[0];
  if (!headerTable) return [];
  const headerRows = Array.from(headerTable.tBodies[0]?.rows ?? []);
  const descriptionIndex = headerRows.findIndex((row) => Boolean(row.querySelector(".enfa-doc-content")));
  const blocks: HTMLElement[] = [];
  const fixedRows = descriptionIndex >= 0 ? headerRows.slice(0, descriptionIndex) : headerRows;
  if (fixedRows.length > 0) blocks.push(tableWithRows(headerTable, fixedRows));
  if (descriptionIndex >= 0) {
    const descriptionCell = headerRows[descriptionIndex]?.querySelector<HTMLTableCellElement>(".enfa-doc-content");
    if (descriptionCell) {
      const richChildren = Array.from(descriptionCell.querySelector<HTMLElement>(".rich-content")?.children ?? []);
      if (richChildren.length > 0) richChildren.forEach((child) => blocks.push(contentTable(headerTable, descriptionCell, child)));
      else blocks.push(contentTable(headerTable, descriptionCell));
    }
  }
  const approvalTable = tables.find((table) => Boolean(table.querySelector(".enfa-approver")));
  if (approvalTable) {
    Array.from(approvalTable.tBodies[0]?.rows ?? []).forEach((row) => blocks.push(tableWithRows(approvalTable, [row])));
  }
  const commentsTable = tables.find((table) => Boolean(table.querySelector(".enfa-comments")));
  const commentsCell = commentsTable?.querySelector<HTMLTableCellElement>(".enfa-comments");
  if (commentsTable && commentsCell) {
    Array.from(commentsCell.querySelectorAll<HTMLElement>(":scope > .enfa-comment-block"))
      .forEach((block) => blocks.push(commentTable(commentsTable, commentsCell, block)));
  }
  return blocks;
}

function createPdfPage(staging: HTMLElement): { page: HTMLElement; article: HTMLElement } {
  const page = document.createElement("section");
  page.className = "enfa-pdf-page";
  const content = document.createElement("div");
  content.className = "enfa-pdf-page-content";
  const article = document.createElement("article");
  article.className = "enfa-doc";
  content.append(article);
  page.append(content);
  staging.append(page);
  return { page, article };
}

function stagePdfPages(element: HTMLElement): { staging: HTMLElement; pages: HTMLElement[] } {
  const staging = document.createElement("div");
  staging.className = "enfa-pdf-staging enfa-pdf-export";
  document.body.append(staging);
  const pages: HTMLElement[] = [];
  let current = createPdfPage(staging);
  pages.push(current.page);
  for (const block of createPdfBlocks(element)) {
    current.article.append(block);
    const content = current.page.querySelector<HTMLElement>(".enfa-pdf-page-content");
    if (content && current.article.scrollHeight > content.clientHeight && current.article.children.length > 1) {
      block.remove();
      current = createPdfPage(staging);
      pages.push(current.page);
      current.article.append(block);
    }
  }
  return { staging, pages };
}

function isFinalDocumentStatus(status: string | undefined): boolean {
  const normalized = status?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  return ["completed", "closed", "final", "approved", "finally_approved", "final_approved"].includes(normalized);
}

async function waitForPrintImages(element: HTMLElement): Promise<void> {
  await Promise.all(Array.from(element.querySelectorAll("img")).map(async (image) => {
    if (!image.complete) {
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }
    try { await image.decode(); } catch { /* optional images do not block export */ }
  }));
}

export async function createPrintFormPdf(
  element: HTMLElement,
  input: { nfaNo: string; documentStatus?: string },
): Promise<{ bytes: Uint8Array; base64: string; filename: string }> {
  let staging: HTMLElement | undefined;
  try {
    await document.fonts?.ready;
    await waitForPrintImages(element);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
    const staged = stagePdfPages(element);
    staging = staged.staging;
    if (!staged.pages.length) throw new Error("The Print Form has no printable pages");
    await waitForPrintImages(staging);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const pageWidth = PDF_PAGE.widthMm - PDF_PAGE.marginMm * 2;
    const pageHeight = PDF_PAGE.heightMm - PDF_PAGE.marginMm * 2 - 9;
    const draft = !isFinalDocumentStatus(input.documentStatus);
    for (let pageIndex = 0; pageIndex < staged.pages.length; pageIndex += 1) {
      const page = staged.pages[pageIndex];
      if (!page) continue;
      const canvas = await html2canvas(page, {
        scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false,
        width: PDF_PAGE.stageWidthPx, height: page.offsetHeight, windowWidth: PDF_PAGE.stageWidthPx,
        scrollX: 0, scrollY: 0,
      });
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", PDF_PAGE.marginMm, PDF_PAGE.marginMm, pageWidth, pageHeight, undefined, "FAST");
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(PDF_PAGE.frameLineWidthMm);
      pdf.rect(PDF_PAGE.marginMm + PDF_PAGE.frameInsetMm, PDF_PAGE.marginMm + PDF_PAGE.frameInsetMm,
        pageWidth - PDF_PAGE.frameInsetMm * 2, pageHeight - PDF_PAGE.frameInsetMm * 2, "S");
      if (draft) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(PDF_PAGE.draftFontSizePt);
        pdf.setTextColor(175, 175, 175);
        pdf.text("DRAFT", PDF_PAGE.widthMm / 2, PDF_PAGE.draftCenterYmm, { align: "center", angle: 45 });
      }
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`ENFA No. ${input.nfaNo || "Draft"} – ${pageIndex + 1} of ${staged.pages.length}`,
        PDF_PAGE.widthMm - PDF_PAGE.marginMm, PDF_PAGE.footerBaselineMm, { align: "right" });
    }
    const bytes = new Uint8Array(pdf.output("arraybuffer"));
    if (bytes.length < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      throw new Error("The generated file is not a valid PDF");
    }
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return { bytes, base64: btoa(binary), filename: `ENFA-${input.nfaNo || "draft"}.pdf` };
  } finally {
    staging?.remove();
  }
}

export function downloadPrintFormPdf(pdf: { bytes: Uint8Array; filename: string }): void {
  const blob = new Blob([pdf.bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = pdf.filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}