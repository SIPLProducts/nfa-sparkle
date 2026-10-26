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

function readVersion(record: SapCommentRecord): number | undefined {
  const key = Object.keys(record).find((candidate) => /^(VER|VERSION)$/i.test(candidate.trim()));
  const value = key ? Number(String(record[key] ?? "").trim()) : NaN;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function commentsFromRecord(record: SapCommentRecord, version: number | undefined): EnfaDocumentComment[] {
  const approverKeys = new Map<number, string>();
  for (const key of Object.keys(record)) {
    const match = key.trim().match(/^APPROVER(\d+)$/i);
    if (match) approverKeys.set(Number(match[1]), key);
  }
  return Object.keys(record)
    .map((key) => ({ key, match: key.trim().match(/^COMMENT(\d+)$/i) }))
    .filter((entry): entry is { key: string; match: RegExpMatchArray } => Boolean(entry.match))
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
    .flatMap(({ key, match }) => {
      const text = String(record[key] ?? "").trim();
      if (!text) return [];
      const level = Number(match[1]);
      const approverKey = approverKeys.get(level);
      const approverId = approverKey ? String(record[approverKey] ?? "").trim() : "";
      return [{ name: "", text, version, level, ...(approverId ? { approverId } : {}) }];
    });
}

/**
 * Maps SAP comment rows (one per VER, with APPROVERn/COMMENTn slots) into Print Form comments.
 * The highest version is the current one; lower versions become numbered history.
 */
export function parseSapPrintComments(value: unknown): EnfaDocumentComment[] {
  const unwrapped = unwrapSapValue(value);
  const rows = (Array.isArray(unwrapped) ? unwrapped : [unwrapped])
    .filter((row): row is SapCommentRecord => Boolean(row) && typeof row === "object" && !Array.isArray(row));
  if (!rows.length) return [];
  const versions = rows.map(readVersion);
  const latest = Math.max(0, ...versions.filter((v): v is number => typeof v === "number"));
  return rows
    .map((row, index) => ({ row, version: versions[index] }))
    .sort((a, b) => (b.version ?? Infinity) - (a.version ?? Infinity))
    .flatMap(({ row, version }) =>
      commentsFromRecord(row, version === undefined || version === latest ? undefined : version));
}

/** Keeps API comments while retaining saved numbered history for versions the API did not return. */
export function mergePrintCommentSources(
  apiComments: EnfaDocumentComment[],
  savedHistory: EnfaDocumentComment[],
): EnfaDocumentComment[] {
  if (!apiComments.length) return savedHistory;
  const apiVersions = new Set(apiComments.map((comment) => comment.version).filter((v) => typeof v === "number"));
  return [
    ...apiComments,
    ...savedHistory.filter((comment) => typeof comment.version === "number" && !apiVersions.has(comment.version)),
  ];
}

/** Pairs SAP comments with the matching approver name (by User ID, then level). */
export function pairPrintCommentsWithApprovers(
  comments: EnfaDocumentComment[],
  approvers: EnfaDocumentApprover[],
): EnfaDocumentComment[] {
  return comments.map((comment, index) => {
    const id = comment.approverId?.trim().toLowerCase() ?? "";
    const byId = id
      ? approvers.find((approver) => approver.userId?.trim().toLowerCase() === id)?.name?.trim()
      : "";
    const byLevel = typeof comment.level === "number"
      ? approvers.find((approver, i) => (approver.level ?? i + 1) === comment.level)?.name?.trim()
      : "";
    const name = comment.name.trim()
      || (id ? byId || comment.approverId?.trim() : byLevel || (comment.version === undefined ? approvers[index]?.name?.trim() : ""))
      || "";
    return {
      ...comment,
      name,
    };
  });
}

/** Keeps current SAP remarks first and fills missing levels from the complete saved approval rows. */
export function mergeCompletePrintComments(
  current: EnfaDocumentComment[],
  saved: EnfaDocumentComment[],
  approvers: EnfaDocumentApprover[],
): EnfaDocumentComment[] {
  const merged = current.map((comment) => ({ ...comment }));
  for (const fallback of saved) {
    const matchIndex = typeof fallback.level === "number"
      ? merged.findIndex((comment) => comment.version === undefined && comment.level === fallback.level)
      : -1;
    if (matchIndex >= 0) {
      const existing = merged[matchIndex];
      if (existing) {
        merged[matchIndex] = {
          ...existing,
          name: existing.name.trim() || fallback.name.trim(),
          text: existing.text.trim() || fallback.text.trim(),
        };
      }
      continue;
    }
    const duplicate = merged.some((comment) =>
      comment.version === fallback.version
      && comment.name.trim() === fallback.name.trim()
      && comment.text.trim() === fallback.text.trim(),
    );
    if (!duplicate) merged.push({ ...fallback });
  }
  return pairPrintCommentsWithApprovers(merged, approvers);
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