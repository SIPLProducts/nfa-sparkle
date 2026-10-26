# Call only the APIs each action needs

## What the code shows today
- **Final Approve PDF:** the Approvals screen reads the record (detail + Select, both with the `edit` payload) and then the shared Print Form preparation reads the same two again, plus the report. One click repeats the same SAP reads. Reject was already fixed this way. Approve, Back to Initiator and Clarification were not.
- **Company logo:** three separate places fetch it (Create NFA, Approvals PDF, Print Form hook). Each one asks SAP again in the same session.
- **Create NFA lookups:** Company, Plant, NFA Type and Function each call SAP when their field changes. Dependent lists can be asked for again even when the value they depend on did not change.
- **Screen entry refresh:** Dashboard, My NFAs, Approvals, Reports, User Management and SAP API Settings reload on entry. A mutation then also invalidates the same lists, which can send two loads one after the other.

## What will change
1. **Measure first.** Click through each action locally (Submit, Approve, final Approve, Reject, Back to Initiator, Clarification, Preview, Edit save, Attachments, Upload, the User Management and SAP API Settings saves, Reports Execute). Record every request each one sends and mark the duplicate or unrelated ones. Anything not confirmed by this step stays unchanged.
2. **Approvals actions:** Back to Initiator and Clarification send only the action request. The final Approve reads the record once and gives that result to the PDF builder. The builder does not read it a second time.
3. **One cached logo:** a single shared logo lookup for each session, used by all three places.
4. **Create NFA lookups:** each list is loaded once for each distinct parent value. Results are reused, and a lookup still in progress is not sent again.
5. **No double reloads:** if a save already refreshes a list, the screen-entry refresh skips that list. If a newer request has started, the older one is dropped.
6. **Requests still in progress:** dialogs (Preview, Edit, Attachments) cancel their requests when they close. Buttons stay disabled while their request is running, so a double click sends one request.

## Not changing
API payloads, endpoints, SAP settings, email rules and recipients, the approval order, PDF content, permissions and screen layout.

## Testing
- Small tests for each source helper:
  - each workflow action lists only its own SAP routes
  - the logo is fetched once
  - repeated lookups for the same parent value are reused
- Local network check for each action before and after the change, then a real Approve and a real Create to confirm the emails and PDF still work.

## Technical details
- Extend `src/lib/approval-action-sources.ts` to give each action its exact reads. Let `prepareWebPrintForm` accept detail/select results that were already loaded, so it skips its own `requestDetail` calls.
- Add a module-level promise cache in `src/lib/sap-logo.ts`. `use-print-form-logo.ts`, `approval-print-pdf.tsx` and `_authed.nfa.new.tsx` all use it.
- In `_authed.nfa.new.tsx`, memoize the lookups by key and use an AbortController to cancel lookups that are no longer needed.
- `useScreenEntryEffect` will coordinate with mutation `invalidateQueries`, and screens will keep a request-sequence guard.
