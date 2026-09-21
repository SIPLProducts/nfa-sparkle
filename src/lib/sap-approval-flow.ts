import type { EnfaDocumentApprover } from "@/components/document/EnfaDocument";

type SapObject = Record<string, unknown>;

function parseJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return value; }
}

function unwrap(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 8; depth += 1) {
    if (typeof current === "string") {
      const next = parseJson(current.trim());
      if (next === current) break;
      current = next;
      continue;
    }
    if (current && typeof current === "object" && !Array.isArray(current)) {
      const object = current as SapObject;
      const key = Object.keys(object).find((candidate) =>
        ["data", "body", "result", "response", "items"].includes(candidate.toLowerCase()),
      );
      if (key) { current = object[key]; continue; }
    }
    break;
  }
  return current;
}

function text(record: SapObject, keys: string[]): string {
  for (const key of keys) {
    const match = Object.keys(record).find((candidate) => candidate.trim().toUpperCase() === key);
    const value = match ? record[match] : undefined;
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

/** Maps SAP's DESIG/USERID level fields into the shared Print Form model. */
export function parseSapApprovalFlow(value: unknown): EnfaDocumentApprover[] {
  const unwrapped = unwrap(value);
  const first = Array.isArray(unwrapped) ? unwrapped[0] : unwrapped;
  if (!first || typeof first !== "object" || Array.isArray(first)) return [];
  const record = first as SapObject;
  return Array.from({ length: 7 }, (_, index): EnfaDocumentApprover => {
    const level = index + 1;
    return {
      role: text(record, [`DESIG${level}`, `ROLE${level}`, `DESIGNATION${level}`]),
      userId: text(record, [`USERID${level}`, `USER_ID${level}`, `USER${level}`, `USRID${level}`, `UID${level}`]),
      name: text(record, [`APPR${level}`, `APPROVER${level}`, `APPR_NAME${level}`, `USER_NAME${level}`]),
      status: text(record, [`STAT${level}`, `STATUS${level}`]),
      actedDate: text(record, [`ACT_DATE${level}`, `APPR_DATE${level}`, `DATE${level}`]),
      actedTime: text(record, [`ACT_TIME${level}`, `APPR_TIME${level}`, `TIME${level}`]),
    };
  }).filter((approver) => Object.values(approver).some((value) => value?.trim()));
}

/** Fills fields level-by-level without discarding richer saved record data. */
export function mergeApprovalFlow(
  existing: EnfaDocumentApprover[] | undefined,
  flow: EnfaDocumentApprover[],
  preferExisting = true,
): EnfaDocumentApprover[] {
  const saved = existing ?? [];
  const count = Math.max(saved.length, flow.length);
  const first = preferExisting ? saved : flow;
  const second = preferExisting ? flow : saved;
  return Array.from({ length: count }, (_, index): EnfaDocumentApprover => ({
    role: first[index]?.role?.trim() || second[index]?.role?.trim() || "",
    userId: first[index]?.userId?.trim() || second[index]?.userId?.trim() || "",
    name: first[index]?.name?.trim() || second[index]?.name?.trim() || "",
    status: first[index]?.status?.trim() || second[index]?.status?.trim() || "",
    actedDate: first[index]?.actedDate?.trim() || second[index]?.actedDate?.trim() || "",
    actedTime: first[index]?.actedTime?.trim() || second[index]?.actedTime?.trim() || "",
  })).filter((approver) => Object.values(approver).some((value) => value?.trim()));
}