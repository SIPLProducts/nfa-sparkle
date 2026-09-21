import type { EnfaDocumentApprover, EnfaDocumentComment } from "@/components/document/EnfaDocument";

const HEADING = /^(Current Version|Version\s+(\d+))\s+Comments\s*:\s*$/i;
const FOOTER = /^E?NFA\s+No\.\s+.+?\s+-\s+\d+\s+of\s+\d+$/i;

type SapCommentRecord = Record<string, unknown>;

function parseJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return value; }
}

function unwrapSapValue(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 8; depth += 1) {
    if (typeof current === "string") {
      const parsed = parseJson(current.trim());
      if (parsed === current) break;
      current = parsed;
      continue;
    }
    if (current && typeof current === "object" && !Array.isArray(current)) {
      const record = current as SapCommentRecord;
      const key = Object.keys(record).find((candidate) =>
        ["data", "body", "result", "response", "items"].includes(candidate.toLowerCase()),
      );
      if (key) {
        current = record[key];
        continue;
      }
    }
    break;
  }
  return current;
}

/** Maps SAP COMMENT1..COMMENTn fields into current-version Print Form comments. */
export function parseSapPrintComments(value: unknown): EnfaDocumentComment[] {
  const unwrapped = unwrapSapValue(value);
  const first = Array.isArray(unwrapped) ? unwrapped[0] : unwrapped;
  if (!first || typeof first !== "object" || Array.isArray(first)) return [];
  const record = first as SapCommentRecord;
  return Object.keys(record)
    .map((key) => ({ key, match: key.trim().match(/^COMMENT(\d+)$/i) }))
    .filter((entry): entry is { key: string; match: RegExpMatchArray } => Boolean(entry.match))
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
    .flatMap(({ key, match }) => {
      const text = String(record[key] ?? "").trim();
      return text ? [{ name: "", text, version: undefined, level: Number(match[1]) }] : [];
    });
}

/** Keeps API current comments while retaining numbered history from the saved SAP document. */
export function mergePrintCommentSources(
  apiComments: EnfaDocumentComment[],
  savedHistory: EnfaDocumentComment[],
): EnfaDocumentComment[] {
  if (!apiComments.length) return savedHistory;
  return [...apiComments, ...savedHistory.filter((comment) => typeof comment.version === "number")];
}

/** Pairs level-based SAP comments with the matching dynamic approver name. */
export function pairPrintCommentsWithApprovers(
  comments: EnfaDocumentComment[],
  approvers: EnfaDocumentApprover[],
): EnfaDocumentComment[] {
  return comments.map((comment, index) => ({
    ...comment,
    name: comment.name.trim()
      || (typeof comment.level === "number" ? approvers[comment.level - 1]?.name?.trim() : "")
      || (comment.version === undefined ? approvers[index]?.name?.trim() : "")
      || "",
  }));
}

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