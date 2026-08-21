# Approvals screen — SAP look and flow

Rebuild the Approvals Inbox so it behaves like the SAP approval transaction: one SAP-driven list, a single row selection, and one toolbar of actions above it.

## Layout (matching the SAP reference)

A clean, modern action toolbar sits above the table with these buttons, in this order:

Preview | Attached Docs | Approve | Reject | Back To Initiator | Clarification

- All buttons are disabled until exactly one record is selected (radio in the first column), same selection behaviour as My NFAs.
- Table columns follow SAP: ENFA No, Plant, Plant Name, NFA Type, Date, Subject, Status, plus the level progress pill already used on My NFAs.
- The current per-row Approve / Reject / Clarify buttons are removed — actions now come from the toolbar only.
- The UI is kept clean and professional: a white card surface, subtle borders, soft shadows, generous whitespace, and a clear visual hierarchy. No User Manual section.

## Data

- The list is loaded from the same SAP Approval Report API used on My NFAs, filtered to records currently awaiting the signed-in approver (derived from the STATUS_TXT / APPR1..APPR6 + STAT1..STAT6 fields in the SAP response).
- Record count, search box, loading, empty ("SAP returned no records") and error states behave as on My NFAs.
- No local database rows are used for the list.

## Actions

- Preview and Attached Docs reuse the working SAP dialogs from My NFAs against the selected ENFA number.
- Approve, Reject, Back To Initiator and Clarification each open the SAP-style comment dialog: title `<ENFA No> — Approval`, a read-only "Comment changed by <user> on <date>" line, and a large free-text comment box, with confirm / clear / cancel actions. Comment is mandatory for Reject, Back To Initiator and Clarification.
- This step is screen and dialog design only. The four action buttons are wired to the dialog but the SAP call is not sent yet — once you share the endpoint, method and payload for each action, they get connected exactly like the other SAP integrations, with SAP's own message shown in the toast and the list refreshed.

## Technical notes

- `src/routes/_authed.approvals.tsx` rewritten: fetches through `/api/public/enfa-approval`, renders `SapReportRow[]`, keeps a single `selected` reffld in state.
- Reuses `RecordPreviewDialog` and `RecordAttachmentsDialog` with `endpoint="my"`.
- New `ApprovalCommentDialog` component for the SAP-style comment popup, taking an action kind and an `onSubmit` hook left ready for the SAP call.
