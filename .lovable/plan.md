# Always refresh screen data on navigation, hard refresh, and new login

## Current behaviour (verified in code)

- Fetched rows are already memory-only (`useScreenMemory` in `src/lib/screen-state.ts`), so a hard refresh, a new tab, or a fresh login starts empty. No change needed there.
- Dashboard, My NFAs, and Approvals already re-fetch on every mount, showing cached rows in the background while the fresh call runs.
- E-NFA Report re-runs the last report on mount only when a report was already run.
- Admin/settings screens (User Management, SAP API Settings, Approval Chain) use TanStack Query with `staleTime: 60_000`, so returning to those screens within 60 seconds shows cached data with no API call.
- `src/router.tsx` has `refetchOnMount: true`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false`.

## Changes

1. **Make query-backed screens refresh on navigation**
   - Drop `staleTime: 60_000` (use the default `0`) on the screen-level queries in `src/routes/_authed.admin.users.tsx`, `src/routes/_authed.admin.sap-api.index.tsx`, and `src/components/admin/ApprovalChainTab.tsx`.
   - With `refetchOnMount: true`, navigating into these screens now issues a fresh call every time; previously loaded data stays rendered while it refetches, so no blank flash and no tab/selection reset.

2. **Keep in-screen tab switching free of refetches**
   - Tabs inside User Management and SAP API Settings mount their query components; to avoid a refetch on every in-screen tab click, mark the screen mount explicitly: fetch on route mount via `queryClient.invalidateQueries` for that screen's keys in a mount effect, and leave the queries themselves with `refetchOnMount: false` inside the tabs.
   - Result: one refresh per navigation into the screen, zero refreshes when switching tabs/tools inside it.

3. **E-NFA Report**
   - Unchanged in spirit: on return, the last-run report re-executes in the background with the same filters. If no report has been run, the screen still waits for Execute.

4. **Unchanged**
   - No refresh on browser tab switch, window focus, DevTools open/close, or network reconnect.
   - Open dialogs, typed values, filters, search text, selected tabs, and selected records stay preserved.
   - No API payload, permission, validation, SAP integration, or backend change.

## Validation

- Dashboard → My NFAs → Dashboard: fresh call each time, filters/tab preserved.
- User Management → another screen → back: users/roles/chains re-fetch; switching between its tabs does not.
- SAP API Settings → another screen → back: endpoints/systems/settings re-fetch; in-screen tabs do not.
- E-NFA Report: run, leave, return → report re-runs in background.
- Hard refresh (F5) or fresh login: no restored rows anywhere; screens fetch from scratch.
- Switch browser tab / open DevTools: nothing refreshes or resets.
