# Retain screen data and tab state when navigating between screens

## Problem (verified)

Every screen keeps its state in plain `useState` inside the route component:

- Dashboard (`src/routes/index.tsx`): `tab` (Ongoing/Completed), search, department/status filters, date range, loaded rows.
- E-NFA Report (`src/routes/_authed.report.tsx`): filter values, fetched rows, "has run" flag, selected row.
- My NFAs (`src/routes/_authed.nfa.my.tsx`): fetched rows, search text, selected row.
- User Management (`src/routes/_authed.admin.users.tsx`): active tab is uncontrolled (`defaultValue="users"`).

TanStack Router unmounts the route component on navigation, so all of that is discarded and every screen refetches and resets to its default tab when you come back.

## What changes for the user

- Switching to another screen and returning restores the screen exactly as you left it: same tab, same filters/search, same result rows, same selected record.
- Lists no longer re-run their SAP/database call on every return; data shows instantly and refreshes in the background only when it is older than a short freshness window (or when you press Refresh / Execute).
- State survives a browser refresh within the same session; closing the tab clears it.
- No visual changes.

## Technical notes

- Add `src/lib/screen-state.ts` — a `useScreenState<T>(key, initial)` hook backed by a module-level `Map` plus `sessionStorage`, with the same API shape as `useState`. Module cache keeps navigation fast; sessionStorage covers reloads. Only serialisable UI state goes in (tab, filters, search, selection, row arrays).
- Dashboard: replace `tab`, `search`, `deptFilter`, `statusFilter`, `dateFrom`, `dateTo`, `filtersOpen` with `useScreenState("dashboard.*")`; move the row load into TanStack Query (`queryKey: ["dashboard-nfas", userId]`, `staleTime` 60s) so returning uses cache and revalidates in the background instead of showing the loading skeleton.
- Report: persist `f` (filters), `rows`, `ran`, `selected` under `report.*`. The Execute action still triggers a fresh call; no automatic refetch on mount.
- My NFAs: persist `rows`, `q`, `selected` under `nfa-my.*`; on mount, render cached rows immediately and refetch in the background only if the cache is empty or older than 60s. The existing Refresh button and post-upload/post-edit refresh keep forcing a live call.
- User Management: make `Tabs` controlled with `value` from `useScreenState("admin-users.tab", "users")`; the existing `useQuery` caches already survive if `staleTime` is set (add 60s to the `managed-users`, `role-defs`, `approval-chains` queries).
- Dialog open/close flags stay local — they should not persist.
- No schema or backend changes.
