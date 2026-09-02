# Reports screen: fetch only on Execute, never auto-load

## Verified current state

- `src/routes/_authed.report.tsx` currently auto-runs the report every time the screen is entered: the `useScreenEntryEffect("/report", ...)` block (lines 299-312) resets filters/rows and then calls `run(false, controller.signal, EMPTY)` — so data loads automatically with empty filters, which is exactly what you want to stop.
- The request payload already matches your sample exactly: 18 keys wrapped in `report` (`user_name`, `plant_from`…`usrid_to`, `r_proc`, `r_comp`, `r_reje`, `r_init`, `r_clar`, with trailing spaces on `nfano_to ` and `extra_to `). No payload change is needed.

## Changes (Reports screen only)

1. **Remove the automatic fetch on screen entry**
   - In `useScreenEntryEffect("/report", ...)`, keep the state reset (filters back to defaults, rows cleared, selection/dialogs closed, `ran`/`error` reset) but delete the `void run(...)` auto-call and its AbortController.
   - Result: returning to the screen shows an empty results area with the "Run the report to see results." prompt — no network request fires until you click Execute.

2. **Execute is the only trigger**
   - Clicking Execute runs the report with exactly the currently selected filters (existing `run()` path, unchanged payload building).
   - No cached or previously loaded rows are ever shown: rows were already cleared on entry, and each Execute replaces the result set with the fresh API response.

3. **Everything else unchanged**
   - Filters, status checkboxes (including `r_init` / `r_clar` as SAP flags), sticky header, results toolbar (Upload / Attached Docs / Preview / Edit), CSV export, pagination, payload structure, and all other screens stay exactly as they are.

## Validation

- Open Reports: no request fires; results area is empty with the prompt.
- Select filters, click Execute: one request with the selected filters in the payload; records render.
- Navigate away and back: filters reset, no request fires, no old data shown.
- Inspect → Network confirms the request body matches your sample structure with the chosen filter values.
