# Rejected NFA PDF stored in SAP shows DRAFT

## Root cause (confirmed in code)
When an approver clicks **Reject**, the portal builds the Print Form PDF and sends it to SAP together with the reject action. At that moment the NFA's status is still "In Process" (SAP only marks it Rejected after it accepts the action). The PDF takes its label from that old status, so it says **DRAFT**. That is the file SAP stored (SIPL_QM161538_02.pdf for NFA 100265).

Final approval already handles this case: it labels the PDF APPROVED ahead of time. Reject does not.

## Fix
- On the Reject action, label the PDF sent to SAP **REJECTED**. This works the same way final approval uses APPROVED.
- Nothing else changes: approve PDFs, other actions, SAP calls, payloads, comments, layout and validations stay as they are.
- Add a small test: Reject → REJECTED, final approve → APPROVED, other cases → current status.

## Notes
- PDFs SAP already stored, like 100265, keep DRAFT. Only rejections made after the change get REJECTED.
- Quality and Production pick up the change after redeploy.

## Technical
`src/routes/_authed.approvals.tsx` ~line 377: `documentStatus: isFinalApproval ? "approved" : action === "reject" ? "rejected" : <row status>`. Move the choice into a small pure helper so it can be tested.
