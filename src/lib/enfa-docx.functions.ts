import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ApproverSchema = z.object({
  role: z.string(),
  userId: z.string(),
  name: z.string(),
  status: z.string().optional(),
  actedDate: z.string().optional(),
  actedTime: z.string().optional(),
});

const CommentSchema = z.object({
  name: z.string(),
  text: z.string(),
  version: z.number().optional(),
});

const GenerateSchema = z.object({
  companyName: z.string(),
  nfaNo: z.string().min(1),
  plantLabel: z.string().optional(),
  date: z.string().optional(),
  initiator: z.string().optional(),
  nfaType: z.string().optional(),
  functionName: z.string().optional(),
  subject: z.string().optional(),
  scopeImpact: z.string().optional(),
  timelineDays: z.string().optional(),
  budgetImpact: z.string().optional(),
  descriptionHtml: z.string().max(2_000_000).optional(),
  approvers: z.array(ApproverSchema).max(30).optional(),
  comments: z.array(CommentSchema).max(200).optional(),
  logoBase64: z.string().max(2_000_000).optional(),
});

type InlinePiece = { text: string; bold?: boolean; italics?: boolean; underline?: boolean };

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

function inlinePieces(html: string): InlinePiece[] {
  const pieces: InlinePiece[] = [];
  const stack: Array<{ bold?: boolean; italics?: boolean; underline?: boolean }> = [{}];
  for (const token of html.split(/(<[^>]+>)/g)) {
    if (!token) continue;
    if (!token.startsWith("<")) {
      const text = decodeEntities(token).replace(/\s+/g, " ");
      if (text) pieces.push({ text, ...stack[stack.length - 1] });
      continue;
    }
    const closing = /^<\//.test(token);
    const tag = token.match(/^<\/?\s*([a-z0-9]+)/i)?.[1]?.toLowerCase();
    if (!tag) continue;
    if (closing) {
      if (["strong", "b", "em", "i", "u"].includes(tag) && stack.length > 1) stack.pop();
      continue;
    }
    if (["strong", "b", "em", "i", "u"].includes(tag)) {
      const current = stack[stack.length - 1] ?? {};
      stack.push({
        ...current,
        bold: current.bold || tag === "strong" || tag === "b",
        italics: current.italics || tag === "em" || tag === "i",
        underline: current.underline || tag === "u",
      });
    }
  }
  return pieces;
}

function textOnly(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).trim();
}

export const generateEnfaDocx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GenerateSchema.parse(input))
  .handler(async ({ data }) => {
    const {
      AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, Packer, Paragraph,
      ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
    } = await import("docx");

    const width = 9360;
    const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
    const borders = { top: border, bottom: border, left: border, right: border };
    const cell = (children: InstanceType<typeof Paragraph>[], size = width, shaded = false) =>
      new TableCell({
        width: { size, type: WidthType.DXA },
        borders,
        shading: shaded ? { fill: "D9D9D9", type: ShadingType.CLEAR } : undefined,
        margins: { top: 70, bottom: 70, left: 110, right: 110 },
        children,
      });
    const run = (text: string, bold = false) => new TextRun({ text, bold, font: "Arial", size: 20 });
    const line = (label: string, value?: string) => new Paragraph({
      spacing: { after: 0 },
      children: [run(`${label}: `, true), run(value ?? "")],
    });
    const oneRow = (children: InstanceType<typeof Paragraph>[], shaded = false) => new Table({
      width: { size: width, type: WidthType.DXA },
      columnWidths: [width],
      rows: [new TableRow({ children: [cell(children, width, shaded)] })],
    });

    const description: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [];
    const html = data.descriptionHtml ?? "";
    const blockPattern = /<(table|h[1-3]|p|ul|ol|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null;
    while ((match = blockPattern.exec(html))) {
      const tag = match[1].toLowerCase();
      const body = match[2];
      if (tag === "table") {
        const rows: InstanceType<typeof TableRow>[] = [];
        for (const rowMatch of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
          const values = Array.from(rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((m) => textOnly(m[1]));
          if (!values.length) continue;
          const colWidth = Math.floor(width / values.length);
          rows.push(new TableRow({ children: values.map((value) => cell([new Paragraph({ children: [run(value)] })], colWidth)) }));
        }
        const firstRowCells = body.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i)?.[1].match(/<t[dh][^>]*>/gi)?.length ?? 1;
        if (rows.length) description.push(new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: new Array(firstRowCells).fill(Math.floor(width / firstRowCells)), rows }));
      } else {
        const listItems = Array.from(body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
        if ((tag === "ul" || tag === "ol") && listItems.length) {
          for (const item of listItems) description.push(new Paragraph({ bullet: { level: 0 }, children: inlinePieces(item[1]).map((p) => new TextRun({ text: p.text, bold: p.bold, italics: p.italics, underline: p.underline ? {} : undefined, font: "Arial", size: 20 })) }));
        } else {
          description.push(new Paragraph({
            heading: tag === "h1" ? HeadingLevel.HEADING_1 : tag === "h2" ? HeadingLevel.HEADING_2 : tag === "h3" ? HeadingLevel.HEADING_3 : undefined,
            spacing: { after: 100 },
            children: inlinePieces(body).map((p) => new TextRun({ text: p.text, bold: p.bold, italics: p.italics, underline: p.underline ? {} : undefined, font: "Arial", size: 20 })),
          }));
        }
      }
    }
    if (!description.length && textOnly(html)) description.push(new Paragraph({ children: [run(textOnly(html))] }));
    if (!description.length) description.push(new Paragraph({ children: [run("")] }));

    const logo = data.logoBase64?.includes(",") ? data.logoBase64.split(",")[1] : data.logoBase64;
    const titleRuns: Array<InstanceType<typeof TextRun> | InstanceType<typeof ImageRun>> = [
      new TextRun({ text: data.companyName, bold: true, font: "Arial", size: 32 }),
    ];
    if (logo) titleRuns.push(new ImageRun({ type: "png", data: Uint8Array.from(atob(logo), (c) => c.charCodeAt(0)), transformation: { width: 120, height: 54 }, altText: { title: "Ramky logo", description: "Ramky logo", name: "Ramky logo" } }));

    const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [
      oneRow([new Paragraph({ alignment: AlignmentType.CENTER, children: titleRuns })]),
      oneRow([new Paragraph({ alignment: AlignmentType.CENTER, children: [run("NOTE FOR APPROVAL", true)] })], true),
      oneRow([line("NFA No", [data.nfaNo, data.plantLabel].filter(Boolean).join(" / ")), line("Date", data.date)]),
      oneRow([line("Initiator", data.initiator), line("NFA Type", data.nfaType), line("Function", data.functionName), line("Sub", data.subject), line("Scope Impact", data.scopeImpact), line("Timeline Impact", data.timelineDays ? `${data.timelineDays} (Days)` : ""), line("Budget Impact", data.budgetImpact ? `Rs.${data.budgetImpact} (Lakhs)` : "")]),
      oneRow([new Paragraph({ alignment: AlignmentType.CENTER, children: [run("DETAILED DESCRIPTION", true)] })], true),
      oneRow(description.filter((item): item is InstanceType<typeof Paragraph> => item instanceof Paragraph)),
    ];
    for (const item of description) if (item instanceof Table) children.push(item);
    children.push(oneRow([new Paragraph({ alignment: AlignmentType.CENTER, children: [run("APPROVALS", true)] })], true));

    const approvers = data.approvers ?? [];
    for (let index = 0; index < approvers.length; index += 3) {
      const group = approvers.slice(index, index + 3);
      while (group.length < 3) group.push({ role: "", userId: "", name: "" });
      children.push(new Table({
        width: { size: width, type: WidthType.DXA }, columnWidths: [3120, 3120, 3120],
        rows: [new TableRow({ children: group.map((a) => cell([line("Role", a.role), line("User id", a.userId), new Paragraph({ children: [run(a.name, true)] }), new Paragraph({ children: [run([a.actedDate, a.actedTime].filter(Boolean).join(" "))] })], 3120)) })],
      }));
    }
    children.push(oneRow([new Paragraph({ alignment: AlignmentType.CENTER, children: [run("COMMENTS", true)] })], true));
    children.push(oneRow((data.comments?.length ? data.comments : approvers.map((a) => ({ name: a.name, text: "" }))).map((comment) => new Paragraph({ children: [run(comment.name, true), run(comment.name && comment.text ? " — " : ""), run(comment.text)] }))));

    const document = new Document({
      styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
      sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }],
    });
    const buffer = await Packer.toBuffer(document);
    return { base64: buffer.toString("base64"), filename: `ENFA-${data.nfaNo}-working.docx` };
  });