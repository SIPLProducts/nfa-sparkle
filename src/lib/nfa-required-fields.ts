/** NFA Type and Function are mandatory only for Predefined Approvers. */
export function missingCreateFields(mode: "predefined" | "dynamic", v: { company: string; nfaType: string; func: string; subject: string }): string | null {
  const dynamic = mode === "dynamic";
  if (!v.company || !v.subject || (!dynamic && !v.nfaType)) {
    return dynamic ? "Company and Subject are required" : "Company, NFA Type and Subject are required";
  }
  if (!dynamic && !v.func) return "Please select a Function before submitting.";
  return null;
}
