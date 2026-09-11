import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { EnfaDocument, type EnfaDocumentProps } from "@/components/document/EnfaDocument";

export interface PrintFormDialogProps extends EnfaDocumentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Read-only "Note for Approval" print form. Every value is supplied by the
 * caller from the form / record — nothing is hardcoded here.
 */
export function PrintFormDialog({ open, onOpenChange, ...doc }: PrintFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-base">Print Form · {doc.nfaNo || "—"}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-border p-3">
          <EnfaDocument {...doc} />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
