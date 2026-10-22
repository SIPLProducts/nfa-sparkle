# Make every Swal popup close on OK

## Cause
When a popup opens over an open window (e.g. Edit NFA "Updated Successfully"), that window blocks clicks and keyboard focus outside itself. The popup is placed outside the window, so OK often does not respond. Only the Attached Docs window currently places popups inside itself.

## Fix (shared popup layer only)
- When a popup opens without a specific target, automatically place it inside the topmost open window, if there is one; otherwise on the page as today.
- Make sure the popup always accepts clicks (OK, Cancel, Confirm) even when the page behind is locked.
- Applies to all success/error/warning/info messages and confirmation prompts. Messages, buttons, and what happens after OK stay the same.

## Technical
- `src/lib/swal.ts`: helper `activeDialog()` returns the last `[role="dialog"][data-state="open"]`; used as default `target` in `fire()` and `swalConfirm()` (with `nfa-swal-in-dialog` container class).
- `src/styles.css`: `.swal2-container { pointer-events: auto; }`.
- Verify in the browser: Edit NFA save → OK closes popup and the window remains usable; a popup with no window open still closes.
