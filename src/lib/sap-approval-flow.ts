import type { EnfaDocumentApprover } from "@/components/document/EnfaDocument";
import { parseApprovalChains } from "@/lib/sap/master";

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
  const saved = (existing ?? []).filter((approver) =>
    Object.values(approver).some((value) => value?.trim()),
  );
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

/** Calls the authenticated app endpoint while keeping SAP credentials server-side. */
export async function fetchSapApprovalFlow(
  input: { plant: string; nfaType: string; functionName: string },
  token: string,
  signal?: AbortSignal,
): Promise<EnfaDocumentApprover[]> {
  if (!input.plant.trim() || !input.nfaType.trim() || !input.functionName.trim() || !token) return [];
  const response = await fetch("/api/public/sap-approval-flow", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
    signal,
  });
  const result = (await response.json()) as {
    ok?: boolean;
    approvers?: EnfaDocumentApprover[];
    message?: string;
    error?: string;
  };
  if (!response.ok || !result.ok) throw new Error(result.message || result.error || "Approval details are unavailable");
  return result.approvers ?? [];
}

function sameSapValue(left: string, right: string): boolean {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

/** Loads a matching chain from SAP's configured Approval Chain endpoint. */
export async function fetchSapApprovalChain(
  input: { plant: string; nfaType: string; functionName?: string },
  token: string,
  signal?: AbortSignal,
): Promise<{ approvers: EnfaDocumentApprover[]; functionName: string }> {
  if (!token) return { approvers: [], functionName: "" };
  const response = await fetch("/api/public/sap-approval-chain", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ approver: "" }),
    signal,
  });
  const result = await response.json() as unknown;
  if (!response.ok) {
    const message = result && typeof result === "object" && !Array.isArray(result)
      ? String((result as SapObject)["error"] ?? "Approval chain is unavailable")
      : "Approval chain is unavailable";
    throw new Error(message);
  }

  const chains = parseApprovalChains(result);
  const plantMatches = input.plant.trim()
    ? chains.filter((chain) => sameSapValue(chain.pspnr, input.plant))
    : chains;
  const typeMatches = input.nfaType.trim()
    ? plantMatches.filter((chain) => sameSapValue(chain.funct, input.nfaType))
    : plantMatches;
  const candidates = typeMatches.length ? typeMatches : plantMatches;
  const exactFunction = input.functionName?.trim()
    ? candidates.find((chain) => sameSapValue(chain.extraTxt, input.functionName ?? ""))
    : undefined;
  const chain = exactFunction ?? (candidates.length === 1 ? candidates[0] : undefined);
  if (!chain) return { approvers: [], functionName: "" };

  return {
    functionName: chain.extraTxt,
    approvers: chain.levels.map((level) => ({
      role: level.designation,
      userId: level.userId,
      name: "",
      status: "",
      actedDate: "",
      actedTime: "",
    })),
  };
}

/** Loads the record-specific flow, falling back to the configured chain API. */
export async function fetchResolvedSapApprovalFlow(
  input: { plant: string; nfaType: string; functionName: string },
  token: string,
  signal?: AbortSignal,
): Promise<{ approvers: EnfaDocumentApprover[]; functionName: string }> {
  const plant = input.plant.trim();
  const nfaType = input.nfaType.trim();
  const functionName = input.functionName.trim();
  if (plant && nfaType && functionName) {
    try {
      const approvers = await fetchSapApprovalFlow({ plant, nfaType, functionName }, token, signal);
      if (approvers.length) return { approvers, functionName };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }
  return fetchSapApprovalChain({ plant, nfaType, functionName }, token, signal);
}