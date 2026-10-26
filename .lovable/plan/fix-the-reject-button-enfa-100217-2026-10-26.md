# Fix the Reject button (ENFA 100217)

## What the checks show
- The Reject request reaches the server with the right data: action `reject`, ENFA `100217`, comment, and the PDF (877 kB).
- SAP answers **HTTP 200 with an empty body**. It does not send "rejected" or any other message.
- The app treats an empty reply as success. So it shows "SAP accepted the rejection" and sends the rejection email. But the record stays in the Approvals list because SAP did not reject it.
- The email log shows **6 rejection emails for 100217 in 15 minutes** (06:32 to 06:47). The initiator got an email every time, even though nothing was rejected. The last attempt was skipped because SAP returned no initiator.
- The request also sends empty recipient details (`initiator: []`, empty approvers). The server looks these up itself, so this is not what blocks the reject.

## Root cause
The app reads SAP's silent empty reply as "rejected". The reason SAP ignores the reject is not confirmed yet. It could be any of these:
1. SAP rejects only when the initiator does it. It has said this before: "Note For Approval Can Only Be Rejected By Initiator". Now it says it with an empty reply.
2. SAP does not accept the large PDF in the reject payload.
3. Something in the user_name or mail_id values doesn't match what SAP expects.

## Steps
1. **Confirm the cause.** Send the same reject for 100217 from the server with dry-run logging, in three versions: as is, without the PDF, and as the initiator. Record what SAP answers each time and whether the record leaves the worklist.
2. **Stop false success.** An empty SAP reply to Reject (and the other actions) is shown as a clear warning: "SAP returned no confirmation, the record was not changed." It is not shown as success. Replies such as "rejected" still show as success, and SAP error texts still show as errors.
3. **Email only on real success.** The rejection email goes out only when SAP confirms the action. No more repeated emails for an action that didn't happen.
4. **Fix the cause found in step 1.** For example, send the PDF the way SAP accepts it, or show SAP's rule to the approver. SAP's endpoint and settings stay as they are.
5. **Test it.** Reject a real record and check three things: the record leaves Approvals, the initiator gets one email, and an empty reply shows a warning and sends no email.

## Not changing
Approve, Back to Initiator, Clarification, the email layout and recipient rules, the Print Form, and other screens.

## Technical details
- `src/routes/api/public/enfa-approve.ts`: when `message === ""` and the reply is not an object with `STATUS`, set `ok:false` with an explicit message. Skip `notifyWorkflowAction` in that case.
- Add a unit test for the reply classification: empty means not ok, "rejected" means ok, "Can Only Be Rejected By Initiator" means not ok.
- The diagnosis uses the existing `callEnfaApprovalAction` with logging of the request summary. The PDF is left out of the logs.
