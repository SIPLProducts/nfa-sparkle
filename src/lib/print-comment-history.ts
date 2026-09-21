import type { EnfaDocumentComment } from "@/components/document/EnfaDocument";

const HEADING = /^(Current Version|Version\s+(\d+))\s+Comments\s*:\s*$/i;
const FOOTER = /^E?NFA\s+No\.\s+.+?\s+-\s+\d+\s+of\s+\d+$/i;

/** Converts the version sections in SAP's saved Print Form into document comments. */
export function parsePrintCommentHistory(lines: string[]): EnfaDocumentComment[] {
  const comments: EnfaDocumentComment[] = [];
  let active = false;
  let version: number | undefined;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;

    const heading = line.match(HEADING);
    if (heading) {
      active = true;
      version = heading[2] === undefined ? undefined : Number(heading[2]);
      continue;
    }
    if (!active || FOOTER.test(line)) continue;

    const separated = line.match(/^(.+?)\s+(?:—|–|-)\s+(.+)$/);
    comments.push({
      name: separated?.[1]?.trim() ?? line,
      text: separated?.[2]?.trim() ?? "",
      version,
    });
  }

  return comments;
}

export function orderedCommentVersions(comments: EnfaDocumentComment[]): Array<number | undefined> {
  const versions = new Set<number>();
  let hasCurrent = false;
  for (const comment of comments) {
    if (typeof comment.version === "number") versions.add(comment.version);
    else hasCurrent = true;
  }
  return [...(hasCurrent ? [undefined] : []), ...Array.from(versions).sort((a, b) => b - a)];
}