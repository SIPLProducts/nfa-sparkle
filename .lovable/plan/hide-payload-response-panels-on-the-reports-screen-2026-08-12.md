# Hide payload/response panels on the Reports screen

The Reports screen currently shows a "Request payload" JSON block and a response/status panel inline. These move out of the page so the screen stays clean; the same information stays fully inspectable in the browser developer tools.

## Changes

- Remove the collapsible "Request payload" panel from the filters card.
- Remove the response panel (Success/Failed chip, status, latency, "Show raw response" block).
- Keep a compact one-line result count ("3 results") above the table.
- Keep error handling: if SAP or the middleware fails, show a toast and an inline error message in the table's empty state (no raw JSON).
- Keep the Execute call as a real browser request so the payload and response remain visible in the Network tab.
- Also log the request payload and parsed response to the browser console on each Execute, so both are available in the Inspect console.

## Technical notes

- All edits are in `src/routes/_authed.report.tsx`: drop the `showPayload` / `showRaw` state and their JSX, drop the `meta` panel render (keep `meta` only for the console log), and remove now-unused imports (`Code2`, chevron icons if unused).
- No change to `runSapEnfaReport` or the endpoint configuration.
