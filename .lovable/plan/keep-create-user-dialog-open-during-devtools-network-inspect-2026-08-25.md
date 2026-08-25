# Keep Create User dialog open during DevTools Network inspection

## What changes

The Create User dialog currently closes automatically when the browser DevTools (Inspect → Network) is opened, which prevents inspecting the outgoing create-user request. The dialog will be changed so it only closes through explicit user actions:

- X button
- Cancel button
- Escape key
- Successful Create user submission

Opening or using DevTools will no longer dismiss the popup.

The exact uppercase SAP-style payload (`USER_ID`, `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `STATUS`, `CONTACT`, `PASSWORD`, `CONFPWRD`, `ROLE`, `EMP_ID`, `DEPT`) already sent by `createManagedUser` will remain unchanged and visible in the Network tab.

## Technical details

- File: `src/routes/_authed.admin.users.tsx`
- In `CreateUserDialog`, pass interaction-block props to `DialogContent`:
  - `onPointerDownOutside={(e) => e.preventDefault()}`
  - `onInteractOutside={(e) => e.preventDefault()}`
  - `onEscapeKeyDown` stays unset so Escape still closes the dialog
- Keep `onOpenChange={onOpenChange}` on `Dialog` so the X button, Cancel button, and successful submit still call `onOpenChange(false)`.
- Do not change the payload builder or the `createManagedUser` call; the uppercase keys and role-to-comma-string mapping stay as they are.
- No migration or backend change is needed.

## Verification

- Open User Management → Create user, fill the form, click Create user, and immediately open Inspect → Network.
- Confirm the dialog remains open.
- Confirm the Network tab shows a request whose payload contains exactly the uppercase keys listed above.
- Confirm Cancel, X, Escape, and successful creation still close the dialog as expected.
