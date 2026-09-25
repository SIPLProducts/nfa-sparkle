type ApprovalAction = "approve" | "reject" | "back_to_initiator" | "clarification";

export function buildApprovalActionPayload(input: {
  action: ApprovalAction;
  wrapper: string;
  template?: string | null;
  reffld: string;
  comment: string;
  userName?: string;
  filePath?: string;
  file?: string;
}): Record<string, unknown> {
  const defaultWrapper = input.action === "back_to_initiator" ? "INITIATOR" : input.wrapper;
  let payload: Record<string, unknown> = { [defaultWrapper]: { REFFLD: "", Comment: "" } };
  if (input.template?.trim()) {
    try {
      const parsed = JSON.parse(input.template) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>;
    } catch { /* retain the compatible fallback */ }
  }
  const wrapperKey = Object.keys(payload).find((key) => key.toLowerCase() === input.wrapper.toLowerCase()) ?? defaultWrapper;
  const savedInner = payload[wrapperKey];
  const inner: Record<string, unknown> = savedInner && typeof savedInner === "object" && !Array.isArray(savedInner)
    ? { ...(savedInner as Record<string, unknown>) }
    : {};
  const refKey = Object.keys(inner).find((key) => key.toLowerCase() === "reffld") ?? "REFFLD";
  const commentKey = Object.keys(inner).find((key) => key.toLowerCase() === "comment") ?? "Comment";
  inner[refKey] = input.reffld;
  inner[commentKey] = input.comment;

  if (input.action === "approve" && input.file && input.filePath) {
    const pathKey = Object.keys(inner).find((key) => key.toLowerCase() === "file_path") ?? "file_path";
    const fileKey = Object.keys(inner).find((key) => key.toLowerCase() === "file") ?? "file";
    const configuredPath = String(inner[pathKey] ?? "").trim();
    const separatorIndex = Math.max(configuredPath.lastIndexOf("/"), configuredPath.lastIndexOf("\\"));
    inner[pathKey] = `${separatorIndex >= 0 ? configuredPath.slice(0, separatorIndex + 1) : ""}${input.filePath}`;
    inner[fileKey] = input.file;
  }

  const callerUser = input.userName?.trim() ?? "";
  if (!callerUser) return { ...payload, [wrapperKey]: inner };
  const userKey = Object.keys(inner).find((key) => key.toLowerCase() === "user_name") ?? "user_name";
  const orderedInner: Record<string, unknown> = { [userKey]: callerUser };
  for (const [key, value] of Object.entries(inner)) {
    if (key.toLowerCase() !== "user_name") orderedInner[key] = value;
  }
  return { ...payload, [wrapperKey]: orderedInner };
}