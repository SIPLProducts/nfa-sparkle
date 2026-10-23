# Stay on Create NFA after a successful submit

## Change
Right now, when SAP accepts a new NFA, the screen shows SAP's success message and then opens My NFAs. After this change it will:
1. Show the same SAP success message.
2. Stay on Create NFA.
3. Clear the form for the next NFA: Company, Plant, NFA Type, Function, Subject, Scope, Budget, Timeline, Detailed Description, attachments, and the selected approvers. Approver mode goes back to Predefined.

If SAP rejects the NFA or the request fails, nothing changes: the error appears and everything you entered stays.

## Not changed
The SAP request and its contents, the checks (including the 2-approver minimum), the company/plant/type lists, Load Sample, and every other screen.

## Technical details
- `src/routes/_authed.nfa.new.tsx` `submit()`: replace `nav({ to: "/nfa/my" })` with `resetForm()`, which sets each form state back to its starting value (including `pending` files and the approver drafts), closes the dialogs, and scrolls to the top.
- `ApproverSelector` reloads by itself when Plant is cleared, so it needs no change. Remove the `useNavigate` hook if nothing else uses it.
- Verify with a mocked successful SAP reply: the page stays on /nfa/new and every field is empty. With a failed reply, the fields are kept.
