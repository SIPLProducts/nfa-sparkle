# Plan: permanently prevent Create User popup from closing during Inspect/Network

## Goal
Make the Create User popup stay open even when browser Inspect/Network changes focus, clicks outside the popup, or resizes the viewport. It should close only by explicit user actions: X, Cancel, Escape, or successful Create User submission.

## Current observation
The current Create User popup still uses the shared Radix dialog root and content. Although outside/focus events are prevented, the dialog component can still emit close state from internal dismiss/focus behavior. This can make the popup close in some browser DevTools workflows.

## Proposed fix
1. Replace the Create User popup usage with a dedicated non-dismissable modal implementation for this screen only.
2. Keep the visual design the same, but remove dependency on Radix automatic outside-dismiss behavior for Create User.
3. Add explicit close controls:
   - X button closes the popup.
   - Cancel button closes the popup.
   - Escape key closes the popup.
   - Successful submit closes the popup.
4. Ignore all other close attempts:
   - outside clicks
   - focus loss
   - DevTools/Inspect focus changes
   - viewport resize
5. Keep the existing Create User payload exactly as-is so Network still shows uppercase keys such as `USER_ID`, `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `PASSWORD`, `CONFPWRD`, and `ROLE`.
6. Re-check the user-admin server-function refresh issue and ensure the page loads without the stale 500 errors.
7. Verify in the browser by opening Create User, entering sample data, clicking outside, changing focus, pressing Escape, and confirming only the intended actions close it.

## Technical details
- Change only the Create User popup path and any small supporting UI code needed for that popup.
- Do not change other dialogs, roles, permissions, backend schema, or Create User business logic.
- If the stale server-function ID appears again, perform a safe dev-server refresh after code edits and re-test the User Management screen.
