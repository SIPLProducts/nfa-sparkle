# Refresh report data on return; never restore data after reload or re-login

## Current behaviour (verified in code)

- `src/lib/screen-state.ts` writes every screen state to `sessionStorage`, so a
  hard refresh (F5) in the same tab restores the previously fetched rows.
- `src/routes/_authed.report.tsx` keeps `rows`, `ran`, `selected` in screen
  state and only fetches when Execute is pressed, so returning to the screen
  shows the old result set with no refresh.
- Dashboard, My NFAs and Approvals already re-fetch in the background on
  navigation into the screen.

## Changes

1. **Result data is memory-only, never persisted across a reload**
   - Split screen state into two kinds:
     - UI state (tabs, filters, search text, expanded panels, selected row) —
       keeps working as today.
     - Fetched data (report rows, dashboard rows, My NFAs rows, approvals rows,
       last-fetched timestamps) — stored in the module-level memory cache only,
       not in `sessionStorage`.
   - Effect: navigating between screens still restores instantly, but a hard
     refresh, a new tab, or a fresh login starts with no cached rows and the
     screen fetches again.

2. **E-NFA Report refreshes on navigation back**
   - When the screen mounts and a report has already been run in this session
     (`ran` is true with saved filters), re-execute the same report in the
     background: keep showing the current rows and selection while the fresh
     SAP call runs, then swap in the new rows.
   - If no report has been run yet, behaviour is unchanged — the screen waits
     for Execute.
   - Manual Execute, filters, and all SAP payloads stay exactly as they are.

3. **Sign-out / login**
   - Sign-out already clears screen state; with data no longer persisted, a new
     login can never show a previous user's fetched rows.

## Technical notes

- Add a `persist: false` option (or a `useScreenMemory` variant) in
  `src/lib/screen-state.ts`; switch row/data keys in `index.tsx`,
  `_authed.nfa.my.tsx`, `_authed.approvals.tsx`, `_authed.report.tsx` to it.
- Also purge any stale `screen-state:` row entries left in `sessionStorage`
  from earlier sessions on first load.
- No API, permission, validation, or backend change.

## Validation

- Run report → go to another screen → come back: rows refresh in the
  background, filters and selection preserved, no blank flash.
- Run report → hard refresh: results are empty until Execute is pressed again.
- Log out and log in as another user: no previous rows anywhere.
- Switch browser tabs / open DevTools: nothing refreshes or resets.
