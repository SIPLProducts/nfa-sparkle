import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { Check, HelpCircle, RotateCcw, X } from "lucide-react";

export type ApprovalAction = "approve" | "reject" | "back_to_initiator" | "clarification";

interface ApprovalCommentDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  enfaNumber: string;
  action: ApprovalAction | null;
  onSubmit: (action: ApprovalAction, comment: string) => void | Promise<void>;
  busy?: boolean;
}

const ACTION_META: Record<ApprovalAction, { title: string; icon: React.ReactNode; className: string; submit: string; requireComment: boolean }> = {
  approve: {
    title: "Approve",
    icon: <Check className="h-4 w-4" />,
    className: "bg-success text-success-foreground hover:bg-success/90",
    submit: "Confirm Approve",
    requireComment: false,
  },
  reject: {
    title: "Reject",
    icon: <X className="h-4 w-4" />,
    className: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    submit: "Confirm Reject",
    requireComment: true,
  },
  back_to_initiator: {
    title: "Back To Initiator",
    icon: <RotateCcw className="h-4 w-4" />,
    className: "bg-accent text-accent-foreground hover:bg-accent/90",
    submit: "Send Back",
    requireComment: true,
  },
  clarification: {
    title: "Clarification",
    icon: <HelpCircle className="h-4 w-4" />,
    className: "bg-primary text-primary-foreground hover:bg-primary/90",
    submit: "Request Clarification",
    requireComment: true,
  },
};

export function ApprovalCommentDialog({ open, onOpenChange, enfaNumber, action, onSubmit, busy = false }: ApprovalCommentDialogProps) {
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const meta = action ? ACTION_META[action] : null;

  useEffect(() => {
    if (open) setComment("");
  }, [open, action]);

  function submit() {
    if (!action) return;
    if (meta?.requireComment && !comment.trim()) return;
    void onSubmit(action, comment.trim());
  }

  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {meta?.icon}
            <span>{enfaNumber}</span>
            <span className="text-muted-foreground">—</span>
            <span>{meta?.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <span className="text-foreground">Comment changed by</span>{" "}
            <span className="font-medium text-foreground">{user?.email || "You"}</span>{" "}
            <span className="text-foreground">on</span>{" "}
            <span className="font-medium text-foreground">{today}</span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="approval-comment" className="text-sm font-medium">
              Comment {meta?.requireComment && <span className="text-destructive">*</span>}
            </label>
            <Textarea
              id="approval-comment"
              placeholder={
                action === "approve"
                  ? "Add an optional comment for approval"
                  : action === "reject"
                    ? "Enter reason for rejection"
                    : action === "back_to_initiator"
                      ? "Enter reason for sending back to initiator"
                      : "Describe what clarification is needed"
              }
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[120px] resize-y"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {meta?.requireComment ? "A comment is mandatory for this action." : "Comment is optional for approval."}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => setComment("")} disabled={busy || !comment}>
            Clear
          </Button>
          <Button
            onClick={submit}
            disabled={busy || (meta?.requireComment && !comment.trim())}
            className={meta?.className || undefined}
          >
            {busy ? "Submitting…" : meta?.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
