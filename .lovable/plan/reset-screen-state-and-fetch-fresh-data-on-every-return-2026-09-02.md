# Reset screen state and fetch fresh data on every return

## Verified current behavior

- Dashboard, Reports, My NFAs, Approvals, User Management, and SAP API Settings retain screen values through `useScreenState` / `useScreenMemory`.
- Dashboard, My NFAs, Approvals, and Reports currently keep old rows visible during a background refresh; Reports only refreshes automatically when a report had already been executed.
- Admin screens invalidate cached queries on entry, but retained tabs, searches, selections, and query data can remain visible while the request runs.
- Detail and change screens fetch on mount, but their local filters, pagination, edits, and selections are not governed by one consistent route-entry reset contract.

## Changes

1. **Introduce a consistent route-entry reset lifecycle**
   - Extend the existing screen-entry pattern so every completed navigation into a screen performs one reset followed by one fresh load.
   - Abort or invalidate older in-flight requests so a late response cannot restore stale data after navigation.
   - Browser focus, reconnects, and re-renders will not count as screen entry.

2. **Clear retained list/report state before fetching**
   - Dashboard: reset active tab, search, all filters, filter panel state, selected/pagination state, cached rows, and fetch timestamps; then load current data.
   - Reports: restore empty/default filters, clear selected record, dialogs/tool state, prior results, errors, and the executed flag; then issue a fresh report request using the default payload so returning always loads current API data.
   - My NFAs and Approvals: clear search, selected record, open action/document state, cached rows, errors, and visible pagination/infinite-scroll progress; then fetch current SAP data.
   - Do not render the previous result set while the new request is pending; use the screen’s existing loading/empty presentation.

3. **Reset query-backed admin screens**
   - User Management: return to the default Users tab, clear search, selection/edit/dialog/draft state, remove the relevant cached query data, and freshly refetch users, roles, permissions, and approval chains.
   - SAP API Settings: return to the default APIs tab, clear selected system, transient forms/tests/dialogs, remove endpoint/system/settings query data, and freshly refetch all screen data.
   - SAP endpoint detail: clear unsaved form/test state and cached endpoint/history data, then fetch the selected endpoint and test history again.

4. **Apply the same contract to detail, edit, and create workflows**
   - NFA Detail: clear audit filters/search, selected action/comment state, pagination position, and previously loaded record/audit/attachment data before loading the latest record.
   - Change Request and Create NFA: discard unsaved temporary field values, pending files, validation/action state, and repopulate only from fresh source data where applicable.
   - Auth and purely transient dialogs continue using their existing mount reset behavior unless the audit finds retained state crossing a navigation boundary.

5. **Preserve integrations and controls**
   - Keep every API endpoint, request payload, response mapping, permission rule, action, pagination component, and visual layout unchanged.
   - Pagination functionality remains intact, but its current page/visible-count resets to the initial position on screen return.
   - In-screen interactions continue to work normally; the reset occurs only after leaving a route and entering it again, not while switching a control within the same active screen.

## Technical details

- Add explicit reset callbacks per route rather than globally clearing all state, preventing one screen’s entry from affecting another currently active workflow.
- Add a screen-state key removal/reset capability so module-level retained values and mounted React state are cleared together.
- For TanStack Query screens, cancel active requests, remove/reset relevant query keys, then refetch; do not reuse stale cached rows for the first returned render.
- For direct fetch screens, clear row state first, set loading state, then call the existing API function with the existing payload logic and request-race protection.
- Reset infinite-scroll counters and page state through route-entry/reset keys without changing page size options or pagination calculations.

## Validation

- Reports: choose filters, Execute, select a row, leave, return — filters and selection are cleared, old rows never appear, and a fresh default report request is visible in Network.
- Dashboard, My NFAs, and Approvals: apply filters/select rows, leave, return — state starts at defaults and one fresh API request replaces an empty/loading state.
- User Management and SAP API Settings: change tabs/search/selection, leave, return — default tab and clean transient state appear, with fresh requests for all required datasets.
- NFA and SAP endpoint details: modify local controls without saving, leave, return — temporary changes are gone and current backend data is loaded.
- Verify pagination still works after loading, but returns to its first page on re-entry.
- Verify actions, uploads, previews, edits, approvals, permissions, API payloads, and UI styling are unchanged.
