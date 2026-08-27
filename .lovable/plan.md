# Refresh data on screen navigation, never on tab/tool switching

## Goal

- Moving from one screen to another (e.g. Dashboard → My NFAs → back) loads fresh data each time.
- Switching browser tabs, opening/closing DevTools, or switching in-screen tabs/panels does **not** refresh anything and does **not** close or reset what is open.

## Current behavior (verified in code)

- `src/router.tsx` sets `refetchOnWindowFocus: false`, `refetchOnReconnect: false`, `refetchOnMount: false` — the last one also blocks refresh on screen navigation.
- Dashboard (`src/routes/index.tsx`), My NFAs (`src/routes/_authed.nfa.my.tsx`), and Approvals (`src/routes/_authed.approvals.tsx`) skip their mount load whenever `fetchedAt > 0`, so returning to a screen shows stale cached rows.
- Report (`src/routes/_authed.report.tsx`) only loads on Execute — this stays as is.
- Tab state is persisted for User Management and SAP API Settings via `useScreenState`; filters/search/selection are persisted on all screens.

## Changes

1. **Query client (`src/router.tsx`)**
   - Keep `refetchOnWindowFocus: false` and `refetchOnReconnect: false` (tab switch / DevTools stay quiet).
   - Change `refetchOnMount` to `true` so navigating into a screen revalidates its queries.

2. **Dashboard, My NFAs, Approvals**
   - Remove the "skip load when already fetched" guard so each screen fetches once per navigation into it.
   - Keep showing the previously cached rows while the fresh fetch runs, so there is no blank/loading flash — replace rows when the new data arrives.
   - Keep search text, filters, selected tab, selected record, and expanded filter panels persisted exactly as they are today.

3. **In-screen tabs and tools stay untouched**
   - Persisted tab state (User Management, SAP API Settings, Dashboard Ongoing/Completed) is unchanged; switching tabs never triggers a reload since data is fetched at screen level, not per tab.
   - Admin/settings queries keep `staleTime: 60_000`, so switching between tabs inside the same screen reuses cache; a fresh navigation into the screen still revalidates.
   - Open dialogs, selections, and typed values remain local and untouched.

## Technical notes

- The mount-time refresh is triggered by the route component mounting (screen navigation), not by window focus, so DevTools/browser-tab focus cannot cause it.
- No API payload, permission, SAP integration, validation, or backend change.

## Validation

- Dashboard → My NFAs → Dashboard: rows refresh, tab/filters/search preserved.
- Approvals → another screen → Approvals: list refreshes, search and selection preserved.
- Switch browser tabs / open DevTools: no refresh, nothing resets or closes.
- Switch tabs inside User Management and SAP API Settings: no reload, no reset.
