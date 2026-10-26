/** Classifies SAP's reply to a workflow action (approve/reject/return/clarify). */
export function classifyActionReply(raw: unknown): { ok: boolean; message: string } {
  if (typeof raw === "string") {
    const message = raw.trim().replace(/^"|"$/g, "").trim();
    if (!message) {
      return { ok: false, message: "SAP returned no confirmation, the record was not changed." };
    }
    if (/can only be|not allowed|cannot|not permitted|no authorization|error/i.test(message)) {
      return { ok: false, message };
    }
    return { ok: true, message };
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const message = String(o["MESSAGE"] ?? o["message"] ?? o["Message"] ?? "").trim();
    const status = String(o["STATUS"] ?? o["status"] ?? "").trim().toUpperCase();
    if (status === "E") return { ok: false, message: message || "SAP reported an error" };
    if (!message && !status) {
      return { ok: false, message: "SAP returned no confirmation, the record was not changed." };
    }
    return { ok: true, message };
  }
  return { ok: false, message: "SAP returned no confirmation, the record was not changed." };
}
