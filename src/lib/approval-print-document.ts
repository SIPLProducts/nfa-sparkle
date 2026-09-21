import type { EnfaDocumentApprover, EnfaDocumentComment } from "@/components/document/EnfaDocument";
import { COMPANIES, PLANTS } from "@/lib/sap/master";

export type PrintDataSource = Record<string, unknown>;

export interface ApprovalPrintDraft {
  subject?: unknown;
  scope_impact?: unknown;
  budget_impact?: unknown;
  timeline_days?: unknown;
  detailed_description?: unknown;
}

export interface ApprovalPrintDocument {
  companyCode: string;
  companyName: string;
  plantLabel: string;
  date: string;
  initiator: string;
  nfaType: string;
  functionName: string;
  subject: string;
  scope: string;
  budget: string;
  timeline: string;
  description: string;
  approvers: EnfaDocumentApprover[];
}

export interface ResolvedApprovalPrintDocument {
  document: ApprovalPrintDocument;
  comments: EnfaDocumentComment[];
  missingFields: string[];
}

const LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;

function nonBlank(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeRecord(value: PrintDataSource | null | undefined): PrintDataSource | null {
  if (!value) return null;
  const normalized: PrintDataSource = {};
  for (const [key, item] of Object.entries(value)) normalized[key.trim().toUpperCase()] = item;
  return normalized;
}

function read(source: PrintDataSource | null, keys: string[]): string {
  for (const key of keys) {
    const value = nonBlank(source?.[key.toUpperCase()]);
    if (value) return value;
  }
  return "";
}

/** Parses the nested and occasionally stringified response envelopes returned by SAP. */
export function parseApprovalPrintDetail(text: string): { detail: PrintDataSource | null; message: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { detail: null, message: "SAP returned no details for this record" };

  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return { detail: null, message: trimmed.slice(0, 500) };
  }

  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof value === "string") {
      const nested = value.trim();
      try {
        value = JSON.parse(nested);
      } catch {
        return { detail: null, message: nested.slice(0, 500) };
      }
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const wrapper = value as PrintDataSource;
      const wrapperKey = ["data", "body", "result", "response", "DATA", "BODY", "RESULT", "RESPONSE"]
        .find((key) => wrapper[key] !== undefined);
      if (wrapperKey) {
        value = wrapper[wrapperKey];
        continue;
      }
    }
    break;
  }

  if (Array.isArray(value)) value = value[0];
  if (!value || typeof value !== "object") {
    return { detail: null, message: "SAP returned no details for this record" };
  }

  const detail = normalizeRecord(value as PrintDataSource);
  const message = read(detail, ["MESSAGE", "ERROR"]);
  const hasRecord = ["REFFLD", "SUBJECT", "CC_TEXT", "PSPNR", "FUNCT", "FUNCT_TXT", "APPR1"]
    .some((key) => read(detail, [key]));
  return hasRecord
    ? { detail, message: null }
    : { detail: null, message: message || "SAP returned no details for this record" };
}

/** Builds the one document model consumed by the Approvals Print Form and PDF. */
export function resolveApprovalPrintDocument(input: {
  editDetail?: PrintDataSource | null;
  selectDetail?: PrintDataSource | null;
  worklistRow?: PrintDataSource | null;
  draft?: ApprovalPrintDraft | null;
  comments?: EnfaDocumentComment[] | null;
}): ResolvedApprovalPrintDocument {
  const editDetail = normalizeRecord(input.editDetail);
  const selectDetail = normalizeRecord(input.selectDetail);
  const worklistRow = normalizeRecord(input.worklistRow);
  const draft = input.draft;
  const merged = (...keys: string[]) =>
    read(editDetail, keys) || read(selectDetail, keys) || read(worklistRow, keys);

  const plantCode = merged("PSPNR", "PLANT", "PLANT_CODE");
  const savedPlant = PLANTS.find((plant) => plant.code === plantCode);
  const plantName = merged("NAME1", "PLANT_NAME") || savedPlant?.name || "";
  const plantCompanyCode = plantName.match(/^([A-Z]+)\s*[-–]/)?.[1] ?? "";
  const savedCompany = COMPANIES.find((company) => company.code === plantCompanyCode)
    ?? COMPANIES.find((company) => company.code === savedPlant?.company);

  const approvers = LEVELS.map((level): EnfaDocumentApprover => ({
    role: merged(
      `ROLE${level}`, `ROLE_${level}`, `DESIG${level}`, `DESIG_${level}`,
      `DESIGNATION${level}`, `DESIGNATION_${level}`, `APPR_ROLE${level}`, `APPROVER_ROLE${level}`,
    ),
    userId: merged(
      `USERID${level}`, `USERID_${level}`, `USER_ID${level}`, `USER_ID_${level}`,
      `USER${level}`, `USER_${level}`, `USRID${level}`, `UID${level}`,
      `PERNR${level}`, `EMPID${level}`, `APPR_USER${level}`, `APPR_ID${level}`,
    ),
    name: merged(
      `APPR${level}`, `APPR_${level}`, `APPROVER${level}`, `APPROVER_${level}`,
      `APPR_NAME${level}`, `APPROVER_NAME${level}`, `USER_NAME${level}`,
    ),
    status: merged(`STAT${level}`, `STAT_${level}`, `STATUS${level}`, `STATUS_${level}`, `APPR_STATUS${level}`),
    actedDate: merged(
      `ACT_DATE${level}`, `ACT_DATE_${level}`, `APPR_DATE${level}`, `APPROVAL_DATE${level}`, `DATE${level}`,
    ),
    actedTime: merged(
      `ACT_TIME${level}`, `ACT_TIME_${level}`, `APPR_TIME${level}`, `APPROVAL_TIME${level}`, `TIME${level}`,
    ),
  })).filter((approver) => Object.values(approver).some((value) => nonBlank(value)));

  const document: ApprovalPrintDocument = {
    companyCode: merged("CC_CODE", "COMPANY_CODE", "BUKRS", "COMP_CODE") || savedCompany?.code || "",
    companyName: merged("CC_TEXT", "COMPANY_NAME", "BUKRS_TEXT", "BUTXT") || savedCompany?.name || "",
    plantLabel: [plantCode, plantName].filter(Boolean).join(" – "),
    date: merged("BEGDA", "DATE", "CREATED_AT"),
    initiator: merged("INIT_NAME", "INITIATOR_NAME", "INITIATOR", "CREATED_BY"),
    nfaType: merged("FUNCT", "FUNCT_TXT", "NFA_TYPE"),
    functionName: merged("EXTR_TXT", "FUNCTION_NAME", "FUNCTION"),
    subject: merged("SUBJECT") || nonBlank(draft?.subject),
    scope: merged("SCOPE_IMPACT") || nonBlank(draft?.scope_impact),
    budget: merged("BUDGET_IMPACT") || nonBlank(draft?.budget_impact),
    timeline: merged("TIMELINE_IMPACT", "TIMELINE_DAYS") || nonBlank(draft?.timeline_days),
    description: nonBlank(draft?.detailed_description) || merged("TEXT", "DETAILED_DESCRIPTION"),
    approvers,
  };

  const suppliedComments = (input.comments ?? []).filter((comment) => nonBlank(comment.name) || nonBlank(comment.text));
  const comments = suppliedComments.length
    ? suppliedComments
    : approvers.filter((approver) => nonBlank(approver.name)).map((approver) => ({ name: approver.name, text: "" }));
  const required: Array<[string, string]> = [
    ["Company", document.companyName],
    ["Plant", document.plantLabel],
    ["Date", document.date],
    ["Initiator", document.initiator],
    ["NFA Type", document.nfaType],
    ["Function", document.functionName],
    ["Subject", document.subject],
    ["Approval Chain", approvers.length ? "available" : ""],
  ];

  return {
    document,
    comments,
    missingFields: required.filter(([, value]) => !value).map(([label]) => label),
  };
}