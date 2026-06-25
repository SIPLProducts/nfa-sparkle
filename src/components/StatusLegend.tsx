import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import {
  STATUS_LABEL,
  STATUS_TONE,
  APPROVER_STATUS_LABEL,
  APPROVER_TONE,
  type NfaStatus,
  type ApproverStatus,
} from "@/lib/nfa-types";

const STATUS_DESC: Record<NfaStatus, string> = {
  with_initiator: "Draft saved by the initiator; not yet submitted for approval.",
  in_process: "Submitted and moving through the approval chain.",
  clarification: "An approver has asked the initiator to clarify before proceeding.",
  completed: "All required approvers have approved. Workflow closed.",
  rejected: "An approver rejected the request. Workflow closed.",
};

const APPROVER_DESC: Record<ApproverStatus, string> = {
  pending: "Awaiting this approver's action.",
  approved: "Approver has approved this level.",
  rejected: "Approver rejected — workflow halted.",
  sent_back: "Sent back to initiator for revision.",
  clarification: "Approver requested clarification.",
};

export function StatusLegend({ compact = false }: { compact?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "icon" : "sm"}
          className={compact ? "h-9 w-9" : "h-9 gap-1.5"}
          aria-label="Status legend"
          title="Status legend"
        >
          <Info className="h-4 w-4" />
          {!compact && <span className="text-xs font-medium">Legend</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-4">
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              NFA Status
            </div>
            <ul className="space-y-1.5">
              {(Object.keys(STATUS_LABEL) as NfaStatus[]).map((k) => (
                <li key={k} className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[k]}`}
                  >
                    {STATUS_LABEL[k]}
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">{STATUS_DESC[k]}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-border pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Approver Status
            </div>
            <ul className="space-y-1.5">
              {(Object.keys(APPROVER_STATUS_LABEL) as ApproverStatus[]).map((k) => (
                <li key={k} className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${APPROVER_TONE[k]}`}
                  >
                    {APPROVER_STATUS_LABEL[k]}
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">{APPROVER_DESC[k]}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}