# Make Swal messages show again

## Likely cause
The last fix places every popup inside the open window. Many actions close that window right after they show a message (e.g. save, then close). The message goes away with the window, so it looks like nothing appeared. Windows can also clip or misplace popups placed inside them.

## Fix (shared popup layer only)
- Show popups on the page again by default, not inside the open window.
- Keep the earlier click fix, so OK, Cancel and Confirm still work while a window is open.
- Only the Attached Docs window, which already asks for it, keeps its popups inside itself.
- Wording, buttons and what happens after OK stay the same.

## Technical
- `src/lib/swal.ts`: remove the automatic `activeDialog()` default in `fire()` and `swalConfirm()`; use only an explicit `target`.
- `src/styles.css`: keep `.swal2-container { pointer-events: auto; }`, and add a high z-index so popups sit above open windows.
- Check in the browser: a success message after Edit NFA save, an error message, and a delete confirmation all appear and close on OK.
