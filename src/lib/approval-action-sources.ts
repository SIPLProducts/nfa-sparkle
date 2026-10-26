export type WorkflowAction = "approve" | "reject" | "back_to_initiator" | "clarification";

/** Record-read routes that send SAP the `edit` payload. Reject must never call them. */
export function editPayloadReadsFor(action: WorkflowAction): string[] {
  if (action === "reject") return [];
  return ["/api/public/enfa-detail", "/api/public/enfa-select"];
}
