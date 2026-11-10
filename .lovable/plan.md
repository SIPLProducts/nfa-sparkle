# Fix Preview status watermark

## Problem
The Preview / Print Form watermark only knows two values: APPROVED (final) and DRAFT (everything else). So a Rejected NFA shows "DRAFT".

## Change
Map the record's overall SAP status (STATUS_TXT / STATUS / ENFA_STATUS, already read today) to its own watermark:

```text
Completed / Closed / Final / Approved / Finally approved -> APPROVED
Rejected / Reject                                        -> REJECTED
Back to Initiator / Withdrawn / Sent back                -> BACK TO INITIATOR
Clarification / Requested clarification / Query          -> CLARIFICATION
In Process / Pending / Submitted / In Approval           -> PENDING
Empty or unknown (unsaved)                               -> DRAFT
```

Matching is case/space/hyphen-insensitive. Only the overall record status is used, never an individual approval level (unchanged rule).

The same label flows to the on-screen preview, printing, and the downloaded PDF, since all three already use one shared helper.

## Not changed
SAP calls, payloads, validations, workflow actions, preview selection logic, and SAP-generated PDFs (their watermark comes from SAP itself).

## Technical details
- `src/lib/print-form-status.ts`: widen `printFormStatusLabel` return type to the six labels.
- `EnfaDocument.tsx` (`data-watermark`) and `print-form-pdf.ts` already pass the label through; confirm the CSS watermark and PDF text render longer labels (shrink font for "BACK TO INITIATOR" if needed).
- Update `print-form-status.test.ts` and `print-form-pdf.test.ts`: rejected -> REJECTED, etc.; run both.
- Update the Print Form watermark memory to the new mapping.
