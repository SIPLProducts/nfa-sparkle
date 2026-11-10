# Show total API count on SAP API Settings

## What changes
- On the Endpoints tab of SAP API Settings, the top row (next to the "New endpoint" button) shows a badge: **Total APIs: N**.
- N is the number of endpoint cards in the list, so it updates by itself whenever an API is added or deleted (the list already refreshes after those actions).
- While the list is loading, a small placeholder shows instead of a number.

## Not changed
- Endpoint cards, create/edit/delete/test actions, saved API settings, other tabs.

## Technical details
- File: `src/routes/_authed.admin.sap-api.index.tsx`, endpoints tab header (`flex justify-end` row → `justify-between`).
- Count = `(data ?? []).length` from the existing `["sap-endpoints"]` query; no new requests.
