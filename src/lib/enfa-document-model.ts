export const ENFA_PAGE = {
  widthDxa: 12240,
  heightDxa: 15840,
  marginDxa: 720,
  contentWidthDxa: 10800,
  richContentWidthDxa: 10360,
  richContentWidthPx: 690,
  pdfWidthMm: 186,
  pdfHeightMm: 273,
} as const;

export interface EnfaDocumentModelInput {
  companyName: string;
  nfaNo: string;
  plantLabel?: string;
  date?: string;
  initiator?: string;
  nfaType?: string;
  functionName?: string;
  subject?: string;
  scopeImpact?: string;
  timelineDays?: string;
  budgetImpact?: string;
  descriptionHtml?: string;
}

export type NormalizedEnfaDocument<T extends EnfaDocumentModelInput> =
  Omit<T, keyof EnfaDocumentModelInput>
  & Required<EnfaDocumentModelInput>;

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

/** One normalized source for the values rendered into Word and the Approver PDF. */
export function normalizeEnfaDocument<T extends EnfaDocumentModelInput>(input: T): NormalizedEnfaDocument<T> {
  return {
    ...input,
    companyName: clean(input.companyName),
    nfaNo: clean(input.nfaNo),
    plantLabel: clean(input.plantLabel),
    date: clean(input.date),
    initiator: clean(input.initiator),
    nfaType: clean(input.nfaType),
    functionName: clean(input.functionName),
    subject: clean(input.subject),
    scopeImpact: clean(input.scopeImpact),
    timelineDays: clean(input.timelineDays),
    budgetImpact: clean(input.budgetImpact),
    descriptionHtml: input.descriptionHtml ?? "",
  } as NormalizedEnfaDocument<T>;
}