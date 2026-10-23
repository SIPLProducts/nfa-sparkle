# Fix dark overlay covering the Create NFA screen

## Cause
The Approvers window added in the last change stays loaded in the background, so your ticks are kept when it closes. Its dark background layer was not hidden along with the window. That layer stays over the whole Create NFA screen even when the window is closed, so the page looks dimmed.

## Fix
- Show the dark background layer only while the Approvers window is open.
- Everything else stays the same: the Approvers window still keeps your ticks and still opens and closes with **Open** and **Done**. Other fields, Submit and what is sent to SAP are unchanged.

## Technical details
- File: `src/routes/_authed.nfa.new.tsx`.
- Render `<DialogPrimitive.Overlay>` only when `approversOpen` is true, by wrapping it in a condition. Also add `data-[state=closed]:hidden` as a safeguard.
- Verify with Playwright that `/nfa/new` is not dimmed, that Open and Done work, and that the ticks are kept.
