# Use SweetAlert consistently for application messages

## Goal
Replace the portal's mixed toast and confirmation experiences with SweetAlert2 while preserving all existing workflows, API calls, validations, dynamic SAP replies, and page layouts.

## Changes
1. **Shared Swal message layer**
   - Add one reusable, browser-safe helper for success, error, warning, information, and confirmation alerts.
   - Match the portal's existing colors, typography, focus behavior, and accessible labels.
   - Preserve dynamic messages returned by SAP and the backend; fallback wording remains only where a response has no message.

2. **Replace transient messages throughout the portal**
   - Convert current toast notifications in sign-in, NFA creation/details/change, My NFAs, Approvals, Reports, Print Form, attachments, User Management, and SAP API Settings.
   - Include the current dynamic “NFA created successfully” response in the Swal success alert.
   - Keep loading text, field validation hints, empty states, and persistent retryable page errors in their existing context because they are page content, not transient messages.

3. **Use Swal for confirmations**
   - Replace endpoint and SAP-system deletion dialogs with Swal confirmations.
   - Add Swal confirmation before role deletion and user deactivation; activation keeps its existing direct action.
   - Keep the approval remark form because it collects mandatory workflow data, then use Swal for validation, outcome, and confirmation feedback without changing approval behavior.

4. **Remove obsolete toast setup**
   - Remove the global toast renderer and unused toast imports only after every caller has moved to the shared Swal helper.
   - Keep unrelated dialogs, business rules, SAP payloads, database behavior, navigation, and permissions unchanged.

## Verification
- Check that no toast calls or browser-native alert/confirm calls remain.
- Verify success, error, warning, and destructive confirmation examples in the live portal.
- Confirm dynamic SAP text is displayed unchanged and cancelled confirmations perform no action.
- Run focused tests and confirm the preview reports no build or runtime errors.

## Technical scope
Frontend presentation only, using the installed SweetAlert2 package and a shared utility. No schema, API contract, workflow, or deployment changes.
