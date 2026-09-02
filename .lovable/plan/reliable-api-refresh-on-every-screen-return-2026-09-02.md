# Reliable API refresh on every screen return

## Confirmed issue

The previous fix only updated the shared entry hook and is currently used by the Dashboard, My NFAs, Approvals, Reports, User Management, and SAP API Settings list screens. Other data screens still rely on mount-only effects or normal query caching, including NFA Detail, Change Request, and SAP Endpoint Detail. This leaves refresh behavior inconsistent and allows previously loaded data to reappear when returning to those screens.

## What will change

- Make route entry detection respond to each completed navigation into a screen, including dynamic routes such as an NFA or SAP endpoint detail page.
- Apply the same refresh contract to every existing data-backed screen:
  - direct API/backend screens will call their existing load function again;
  - TanStack Query screens will invalidate and actively refetch their existing query keys;
  - screens whose data is naturally fetched on every fresh mount will retain that behavior.
- Keep the existing rows visible during background refresh, then replace them with the latest API response, including a valid empty result.
- Preserve UI-only state such as filters, selected tabs, pagination, search values, and dialog behavior; no payloads, endpoints, permissions, visual styling, or business rules will change.
- Prevent an older in-flight request from overwriting a newer response when navigation happens quickly.

## Technical details

- Refine `useScreenEntryEffect` to support exact and dynamic route instances and to key execution to router navigation state rather than a component-local one-time guard alone.
- Audit every route under `src/routes` that reads remote data and wire its existing loader/query/fetch function into route-entry refresh instead of introducing duplicate API logic.
- Add entry refresh to the currently uncovered detail routes, including their parameter-specific query keys or load callbacks.
- Keep cached data separate from retained UI state: fetched rows are refreshed on entry, while filters/tabs/pagination remain unchanged.
- Verify with navigation round trips across Dashboard, My NFAs, Approvals, Reports, User Management, SAP API Settings, and representative detail pages; confirm a fresh network request occurs once per return and that filters/pagination do not reset.