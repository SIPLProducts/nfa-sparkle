# Fix Preview status watermark

## Problem
The Preview / Print Form watermark only knows APPROVED (final) and DRAFT (everything else), so a Rejected NFA shows "DRAFT".

## Change
Map the record's overall SAP status (STATUS_TXT / STATUS / ENFA_STATUS, already read today):

```text
Approved / Completed / Closed / Final / Finally approved -> APPROVED  (unchanged)
Rejected / Reject                                       -> REJECTED  (new)
Everything else (In Process, Pending, Clarification,
Back to Initiator, empty, unknown)                      -> DRAFT     (unchanged)
```

Matching stays case/space/hyphen-insensitive and uses only the overall record status. The same label is used by the on-screen preview, printing, and the PDF.

## Not changed
SAP calls, payloads, validations, workflow actions, preview selection, and SAP-generated PDFs.

## Technical details
- `src/lib/print-form-status.ts`: add "rejected"/"reject" -> "REJECTED"; widen return type.
- Confirm `EnfaDocument` watermark CSS and `print-form-pdf.ts` render "REJECTED".
- Update `print-form-status.test.ts` and `print-form-pdf.test.ts` (rejected now REJECTED); run both.
- Update the Print Form watermark memory.
