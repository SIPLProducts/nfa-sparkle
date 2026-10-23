# Preview "X" shows the same web Print Form as the Print Form button

## Confirmed differences today
When SAP answers `X`, Preview builds its own copy of the form instead of reusing the Print Form button's view:
- It skips the shared clean-up step the Print Form uses before showing the document (blank and duplicate values, field order, approver rows).
- It never runs the Print Form's approval-chain refresh, so approver names, roles and the Function can be missing or different.
- It uses a different paper background and still has its own inner scroll box limited to 70% of the screen, which hides the approver grid and comments on small screens.
- The Download PDF uses that different copy, so the file can also differ.

## Changes
1. Move the Print Form's document area (clean-up, approval-chain refresh, logo, status watermark and paper styling) into one shared piece used by both the Print Form button and Preview.
2. When Preview gets `X`, show that shared piece in read-only mode with the same record data the Print Form button loads. The result is the same layout, header fields, Detailed Description, approver grid, comments, logo and watermark.
3. Preview's Download and Print for the `X` case use the shared document, so the PDF matches the Print Form's PDF.
4. Use one scroll area in the Preview window, the same as the Print Form window, so nothing is hidden.

## Not changed
- The SAP PDF branch (valid Base64 PDF) and its Open, Download and Print buttons.
- The Print Form button's behaviour, editing, DOCX, approvals, emails, attachments, permissions and all SAP API calls.

## Verification
- Open the same eNFA through Print Form and through Preview with a controlled `X` reply, signed in, in Reports, My NFAs and Approvals. Compare screenshots field by field, including at your screen size (889 x 529).
- Download both PDFs and confirm they match.
- Run the existing Print Form and Preview tests.

## Technical details
- New `src/components/document/PrintFormSheet.tsx`: wraps `EnfaDocument` with `normalizeEnfaDocument`, the `fetchResolvedSapApprovalFlow` + `mergeApprovalFlow` refresh, `usePrintFormLogo`, and `enfa-print-area bg-white p-2`; forwards a ref for `createPrintFormPdf`.
- `PrintFormDialog.tsx`: render `PrintFormSheet` in place of the inline block (no behaviour change).
- `RecordPreviewDialog.tsx`: X branch renders `PrintFormSheet` with `approvalFlow` derived from the loaded document (plant code, NFA type, function); remove `max-h-[70vh] overflow-y-auto` from that wrapper. PDF canvas branch untouched.
