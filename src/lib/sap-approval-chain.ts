export const MAX_APPROVAL_LEVELS = 7;

export interface EditableApprovalLevel {
  designation: string;
  userId: string;
}

export interface EditableApprovalChain {
  pspnr: string;
  funct: string;
  extraTxt: string;
  begda: string;
  endda: string;
  lineIndex: string;
  levels: EditableApprovalLevel[];
}

export type ApprovalChainOperation = "save" | "update" | "delete";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function validateApprovalChain(chain: EditableApprovalChain, operation: ApprovalChainOperation = "save") {
  if (!clean(chain.pspnr)) throw new Error("Project is required");
  if (!clean(chain.funct)) throw new Error("NFA Type is required");
  if (!clean(chain.extraTxt)) throw new Error("Function is required");
  if (!clean(chain.begda)) throw new Error("Valid From is required");
  if (!clean(chain.endda)) throw new Error("Valid To is required");
  if (chain.levels.length > MAX_APPROVAL_LEVELS) {
    throw new Error(`SAP supports up to ${MAX_APPROVAL_LEVELS} approval levels`);
  }
  if (operation === "delete") return;
  if (!chain.levels.length) throw new Error("Add at least one approval level");

  const users = new Set<string>();
  for (const [index, level] of chain.levels.entries()) {
    const designation = clean(level.designation);
    const userId = clean(level.userId);
    if (!designation || !userId) {
      throw new Error(`Level ${index + 1} requires both Designation and User ID`);
    }
    const normalizedUser = userId.toLowerCase();
    if (users.has(normalizedUser)) throw new Error("The same user cannot appear on two approval levels");
    users.add(normalizedUser);
  }
}

/** Converts a stored date (ISO or SAP compact) to SAP's delete format YYYY-MM-DD. */
function toIsoDate(value: string) {
  const digits = clean(value).replace(/[^0-9]/g, "");
  if (digits.length !== 8) return clean(value);
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export type ApprovalChainPayload = Record<string, Record<string, string>>;

/** Builds SAP's exact seven-slot Approval Chain management payload. */
export function buildApprovalChainPayload(
  chain: EditableApprovalChain,
  operation: ApprovalChainOperation = "save",
): ApprovalChainPayload {
  validateApprovalChain(chain, operation);

  if (operation === "delete") {
    const deleteUser: Record<string, string> = {
      MANDT: "",
      PSPNR: clean(chain.pspnr),
      FUNCT: clean(chain.funct),
      EXTR_TXT: clean(chain.extraTxt),
      BEGDA: toIsoDate(chain.begda),
      ENDDA: toIsoDate(chain.endda),
    };
    for (let index = 0; index < MAX_APPROVAL_LEVELS; index += 1) {
      const level = chain.levels[index];
      deleteUser[`DESIG${index + 1}`] = clean(level?.designation);
      deleteUser[`USERID${index + 1}`] = clean(level?.userId);
    }
    return { delete_user: deleteUser };
  }

  const createUser: Record<string, string> = {
    pspnr: clean(chain.pspnr),
    Funct: clean(chain.funct),
    EXTR_TXT: clean(chain.extraTxt),
    BEGDA: clean(chain.begda).replace(/[^0-9]/g, ""),
    endda: clean(chain.endda).replace(/[^0-9]/g, ""),
  };

  for (let index = 0; index < MAX_APPROVAL_LEVELS; index += 1) {
    const level = chain.levels[index];
    createUser[`DESIG${index + 1}`] = clean(level?.designation);
    createUser[`USERID${index + 1}`] = clean(level?.userId);
  }
  createUser["LINE_INDEX"] = clean(chain.lineIndex);
  return { [operation === "update" ? "Update_user" : "create_user"]: createUser };
}

export function approvalChainResponseMessage(raw: unknown): { ok: boolean; message: string } {
  let value = raw;
  if (typeof value === "string") {
    const text = value;
    try {
      value = JSON.parse(text);
    } catch {
      return { ok: true, message: text.trim() || "Approval chain saved" };
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value) && "body" in value) {
    return approvalChainResponseMessage((value as { body: unknown }).body);
  }
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return { ok: true, message: "Approval chain saved" };
  const record = row as Record<string, unknown>;
  const type = clean(record["TYPE"] ?? record["type"]).toUpperCase();
  const message = clean(record["MESSAGE"] ?? record["message"] ?? record["error"]);
  return {
    ok: type !== "E" && type !== "A" && !record["error"],
    message: message || (type === "E" || type === "A" ? "SAP rejected the approval chain" : "Approval chain saved"),
  };
}