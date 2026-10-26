# Stop the Reject button from calling SAP with the Edit payload

## What the checks show
Reject does not send an Edit request on its own. Before it sends the rejection, the Approvals screen builds the Reject PDF and looks up the initiator. Those two steps send `{ "edit": { "user_name", "reffld" } }` to SAP several times:

1. **Reading the record for the PDF:** the screen calls "Get ENFA Number Deatils" (a PUT with the `edit` payload) and the record Select, each with the same `edit` payload.
2. **The same read again:** the shared Print Form preparation then repeats both calls.
3. **Initiator lookup:** the screen sends the `edit` payload to the record Select once more, only to find the initiator's User ID.

So one Reject click sends 5 requests with the Edit payload before the actual `reject` request. That is what you see in the Network tab.

## Fix (Reject only)
- **Initiator lookup:** Reject no longer reads SAP with the Edit payload to find the initiator. The server already finds the initiator itself when it sends the email (from SAP Select and the approval flow), so emails still reach the right person.
- **The PDF:** Reject builds its PDF without any Edit-payload call. It uses data that is already loaded or read without that payload:
  - the Approvals list row
  - the Report API row for this ENFA
  - the saved NFA details and Detailed Description
  - the saved approval chain and comments
  - the approval flow and logo
- **What reaches SAP:** after these changes, a Reject click sends SAP only the `reject` request (plus read-only report, flow and logo lookups). The `reject` payload stays exactly as today: user_name, mail_id, REFFLD, Comment, file_path, file.

## Not changing
Approve (including the final approval PDF), Back to Initiator, Clarification, Preview, Edit NFA, the email rules, and SAP endpoints and settings.

## Testing
- Add a test: building the Reject PDF must never call the record-detail or Select routes with an `edit` payload.
- Reject a record locally and confirm in the request log that no `edit` payload is sent, the PDF still has its content, and the rejection email goes to the initiator.

## Technical details
- `_authed.approvals.tsx` `submitAction`: when `action === "reject"`, skip the `requestDetails("/api/public/enfa-detail" | "/api/public/enfa-select")` calls and the `initiatorLookup` fetch. Build `resolveApprovalPrintDocument` from the worklist row, `reportRow`, the draft, `loadApprovalPrintContext` and `loadPrintComments`. Don't call `prepareWebPrintForm` here, because it makes the same Edit-payload calls.
- Move the Reject PDF source assembly into a small pure helper, so the test can check which routes it calls.
