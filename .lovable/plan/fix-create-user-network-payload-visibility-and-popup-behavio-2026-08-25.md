# Fix Create User Network payload visibility and popup behavior

## Goal
Make Create User easy to inspect in DevTools Network:

- The request payload should appear as the exact JSON keys you expect: `USER_ID`, `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `STATUS`, `CONTACT`, `PASSWORD`, `CONFPWRD`, `ROLE`, `EMP_ID`, `DEPT`.
- The response should show a clear success result when the user is created.
- The Create User popup should stay open while creating the user and while using Inspect → Network.
- The popup should close only when clicking X or Cancel.

## Confirmed current behavior
- The Create User form already builds the required uppercase payload keys in `src/routes/_authed.admin.users.tsx`.
- The current Create User call uses a framework server-function request, so DevTools shows an internal serialized payload instead of the plain JSON body.
- The current popup is already a custom modal and does not rely on the shared auto-dismiss dialog for Create User.
- Current submit behavior shows a success toast and refreshes the user list without closing the popup.

## Changes to make
1. Add a dedicated Create User raw JSON API route for the User Management screen.
2. Move the shared user-creation logic into a server-only helper so both the existing server function and the new raw API route can use the same validation and creation flow.
3. Update the Create User form submit to call the raw JSON API route with `fetch()` and `JSON.stringify(payload)` so DevTools shows the exact request body.
4. Include the signed-in user token in the request header and verify admin permission on the server before creating the user.
5. Return a clear JSON response, for example `{ "ok": true, "id": "...", "message": "User created successfully" }`.
6. Keep the Create User popup open after successful creation so the user can inspect request and response in Network.
7. Keep only X and Cancel as popup close actions.
8. Preserve existing validation, password confirmation, role assignment, toast messages, and user-list refresh.

## Technical details
- New route: a TanStack server route under `src/routes/api/public/...` that accepts a raw POST body.
- Security: the route will reject requests without a valid signed-in session and admin role.
- Existing `createManagedUser` server function remains available for compatibility but delegates to the same helper.
- The Create User UI will call the raw endpoint only for create-user submissions; edit user, reset password, roles, and permissions remain unchanged.

## Validation
- Open User Management → Create user.
- Fill the form and click Create user.
- Confirm DevTools Network shows a POST request with the exact JSON payload keys.
- Confirm the response JSON shows user created successfully.
- Confirm the popup remains open after submit.
- Confirm clicking X closes it.
- Confirm clicking Cancel closes it.
- Confirm opening or using Inspect → Network does not close it.
