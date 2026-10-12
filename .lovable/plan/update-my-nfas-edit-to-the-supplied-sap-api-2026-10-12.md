# Update My NFAs Edit to the supplied SAP API

## Scope
Update **My NFAs → Edit**, using the existing **MY NFA Select** setting shown in your screenshot. Keep the existing popup, Save behavior, Preview, attachments, approvals, and other screens unchanged.

## Confirmed from the code
- My NFAs Edit calls the registered **MY NFA Select** service; the SAP URL, method, system, and credentials come from SAP API Settings.
- The request already supplies `edit.user_name` from the signed-in user's User ID and `edit.reffld` from the selected NFA.
- The provided response is already supported for Company, Plant, NFA Type, Subject, Scope Impact, Budget Impact, Timeline, and `TEXT`.
- Function currently reads the worklist row instead of the returned `EXTR_TXT`. Initiator currently depends on a separate load triggered by opening Print Form, rather than the Edit response's `INIT_USERID`.
- The Quality synchronization script already lists the supplied approval-service path and PUT for MY NFA Select, but its request template omits `user_name`. The deployed company's actual settings have not been verified.

## Changes
1. **Align the existing Edit API setting.** Verify MY NFA Select uses your supplied `http://10.200.1.2:8000/e-nfa/enfa_approval/APPROVAL?sap-client=300` address and **PUT**. Change only that setting when necessary; preserve its identity, SAP system, credentials, and other endpoint settings.
2. **Keep request values dynamic.** Use the request structure `{"edit":{"user_name":"","reffld":""}}`, filling both values at runtime from the signed-in user and selected NFA. Never store `SIPL_QM`, `100148`, or sample response values as application defaults. If the signed-in User ID cannot be resolved, show a clear error rather than substitute SAP connection credentials.
3. **Populate the existing Edit popup from SAP.** Use returned `EXTR_TXT` for Function and `INIT_USERID` for Initiator, retaining existing fallback behavior where SAP omits fields. Preserve the existing handling of numeric impact values, empty `TEXT`, and saved rich Detailed Description; no storage or workflow redesign.
4. **Provide a focused self-hosted settings update.** Add a standalone, rerunnable update for MY NFA Select only, including both request fields. Do not require running the broad SAP synchronization script or change Preview/attachment settings.

## Technical details
- Keep the browser-to-portal POST request; **PUT** applies to the portal-to-SAP call.
- Continue using the existing settings-driven SAP caller and authenticated request path.
- Limit display changes to the My NFAs Edit branch of the shared dialog so Reports Edit remains unchanged.
- Preserve supported direct and wrapped SAP response formats and existing SAP refusal messages.

## Verification
- Regression-test dynamic request substitution with different User IDs and NFA numbers, the supplied response shape, zero numeric values, empty `TEXT`, and SAP refusal/error responses.
- Check the signed-in Edit flow: select an NFA, open the popup, confirm outgoing SAP method/payload and populated fields, and ensure existing Save behavior is preserved.
- Verify the settings update is safe to rerun and does not modify credentials or unrelated endpoints.
- Report controlled checks separately from a live SAP check. If the company SAP service is unreachable from this preview, final live verification will require deployment and retrying Edit on the company server.