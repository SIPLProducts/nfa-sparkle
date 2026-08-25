# Plan: keep Create User popup open during Inspect/Network use

## Goal
Make the Create User dialog stay open while using browser Inspect/Network, and only close when the user intentionally finishes or cancels creation.

## Current observation
The Create User dialog already has `onPointerDownOutside` and `onInteractOutside` handlers, but the root dialog still receives `onOpenChange={setCreateOpen}`. If the dialog library emits a generic close event from focus loss, inspection, or another automatic interaction, it can still close the popup.

## Proposed fix
1. Replace the direct `onOpenChange={setCreateOpen}` behavior for Create User with a guarded close handler.
2. Ignore automatic close requests from the dialog root while the Create User popup is open.
3. Add explicit close paths only for:
   - X close button
   - Cancel button
   - Escape key
   - successful Create User submission
4. Update the dialog close icon if needed so it calls the explicit close handler instead of relying on the default dialog auto-close.
5. Keep the existing uppercase Create User request payload unchanged so the Network tab still shows the required keys.
6. Verify by opening Create User, entering sample values, clicking/focusing outside the dialog, and confirming the dialog remains open until Cancel/X/Escape/success.

## Technical details
- Change only the User Management route and, only if required, add a small optional prop to the shared dialog component for custom close handling.
- Avoid changing other dialogs or user-management business logic.
- Preserve existing create-user submit flow and validation.
