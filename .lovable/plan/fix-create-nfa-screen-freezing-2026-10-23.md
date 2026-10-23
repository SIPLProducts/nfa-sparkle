# Fix Create NFA screen freezing

## Root cause
The Approvers window added recently is kept permanently mounted (so ticks are kept when closed). While mounted, the underlying modal layer stays active even when the window is closed: it blocks clicks on the rest of the page (pointer events disabled on the body), hides the page from focus/assistive tech, and traps scrolling. Result: the Create NFA screen looks normal but stops responding — it "freezes".

## Fix (Create NFA screen only)
- Replace the always-mounted modal with a lightweight panel that is always rendered but simply shown/hidden:
  - Hidden: no overlay, no click/scroll/focus blocking — page fully usable.
  - Open: dimmed backdrop + centered card with the same title, description, approver list and Done button; Esc and clicking the backdrop close it.
- The approver list stays mounted the whole time, so selected approvers persist exactly as today.
- No change to Detailed Description dialog, fields, approver selection logic, Create NFA payload (`check`, 15 slots), APIs or workflow.

## Verify
- Open Create NFA: dropdowns, radio buttons, upload, scrolling all respond.
- Open Approvers, tick approvers, Done; count updates; page still responsive; Submit sends same payload.

## Technical details
- `src/routes/_authed.nfa.new.tsx`: remove `DialogPrimitive.Root/Portal/Content forceMount` block; render a `fixed inset-0 z-50` wrapper with `hidden` class when `!approversOpen`, backdrop `onClick` closes, `keydown` Escape listener only while open, `role="dialog" aria-modal`. Drop unused `@radix-ui/react-dialog` import.
