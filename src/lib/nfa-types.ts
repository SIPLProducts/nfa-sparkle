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

export const STATUS_TONE: Record<NfaStatus, string> = {
  with_initiator: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  in_process: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  clarification: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  completed: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

export const APPROVER_TONE: Record<ApproverStatus, string> = {
  pending: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  approved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  sent_back: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  clarification: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
};