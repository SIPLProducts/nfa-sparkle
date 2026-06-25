export type NfaStatus = "with_initiator" | "in_process" | "clarification" | "completed" | "rejected";
export type ApproverStatus = "pending" | "approved" | "rejected" | "sent_back" | "clarification";

export interface NfaRow {
  id: string;
  enfa_number: string;
  initiator_id: string;
  company: string;
  plant: string | null;
  plant_name: string | null;
  project: string | null;
  nfa_type: string;
  function: string | null;
  subject: string;
  scope_impact: string | null;
  budget_impact: number | null;
  timeline_days: number | null;
  detailed_description: string | null;
  status: NfaStatus;
  current_level: number;
  created_at: string;
  updated_at: string;
}

export interface ApproverRow {
  id: string;
  nfa_id: string;
  level: number;
  approver_id: string;
  designation: string | null;
  status: ApproverStatus;
  comment: string | null;
  acted_at: string | null;
}

export const STATUS_LABEL: Record<NfaStatus, string> = {
  with_initiator: "With Initiator",
  in_process: "In Process",
  clarification: "Requested Clarification",
  completed: "Completed",
  rejected: "Rejected",
};

export const APPROVER_STATUS_LABEL: Record<ApproverStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  sent_back: "Sent Back",
  clarification: "Clarification",
};