# Plan: Stop screen refresh on return navigation

## Goal
Keep each screen exactly where the user left it when moving to another screen and coming back: loaded data, selected tab, filters/search text, and selected record should remain visible instead of resetting or reloading.

## Confirmed current behavior from code
- Dashboard, E-NFA Report, My NFAs, and User Management already use the new session-backed screen state in some places.
- Some screens still reset because they keep important UI state in local component state or auto-run data loads on mount:
  - Approvals Inbox still uses local state for rows, search, and selected record, and calls `load()` every time the route mounts.
  - SAP API Settings still uses `Tabs defaultValue="apis"`, so the selected tab resets on return.
  - SAP API Settings queries have no cache freshness window, so the visible data can refetch immediately on remount.
  - User Management persists the main tab, but the Users search box still resets because it is local state.
- Dashboard and My NFAs still auto-refresh when cached data is older than 60 seconds, which can look like the screen is refreshing after navigation.
- The app's default Query Client currently uses the library defaults, so query-based admin/settings screens can refetch when the browser regains focus, including after switching tabs or opening/closing DevTools.

## Changes to make
1. **Make restore-on-return strict**
   - If a screen already has cached rows/data in the current browser session, render that cached state immediately and do not auto-fetch again just because the user navigated away and back.
   - Disable automatic query refetch on browser focus/reconnect so switching browser tabs or opening/closing DevTools does not trigger visible refreshes.
   - Keep manual actions like **Refresh**, **Execute**, **Save**, **Approve**, **Reject**, and mutation-triggered reloads working as they do now.

2. **Approvals Inbox**
   - Persist loaded rows, search text, selected record, and last fetched time with the existing screen-state helper.
   - Remove the mount-time forced reload when rows are already cached.
   - Keep the **Refresh** button and approval-action refresh behavior intact.

3. **Dashboard**
   - Preserve tab, filters, expanded filter state, dashboard rows, and pending approvals without reloading on return navigation.
   - Only load automatically when there is no cached dashboard data for the session.

4. **My NFAs**
   - Preserve loaded SAP rows, search text, and selected record without reloading on return navigation.
   - Only load automatically when no cached rows exist; keep **Refresh** as the explicit reload.

5. **User Management**
   - Keep the selected User Management tab persisted.
   - Persist the Users search field so returning to the Users tab keeps the same filtered view.
   - Keep role/user/permission query caching so data does not flicker or immediately refetch on tab navigation.

6. **SAP API Settings**
   - Convert the settings tabs from uncontrolled default tab to a persisted controlled tab.
   - Add cache freshness to endpoint, SAP system, and middleware settings queries to avoid visible refetch/reset when returning.
   - Preserve selected SAP system/form context where practical, without persisting sensitive password fields.

7. **Global query behavior**
   - Configure the app's Query Client so browser focus changes and network reconnect events do not automatically refetch current screens.
   - Keep explicit invalidation after saves/deletes/actions, so changed data still refreshes when the app itself requests it.

## Technical notes
- Use the existing `useScreenState` helper; do not introduce a new storage mechanism.
- Do not persist modal open states, passwords, secrets, or file inputs.
- Do not change any API payloads, permissions, SAP integration behavior, existing button actions, or backend/database logic.
- Keep explicit refresh/reload behavior available through existing user actions.

## Validation
- Navigate from Dashboard to another screen and back: selected tab and filters remain, and rows do not show a loading reset.
- Navigate from Approvals Inbox to another screen and back: search, selected record, and list remain.
- Navigate from My NFAs to another screen and back: search, selected record, and rows remain.
- Navigate within User Management and SAP API Settings: selected tabs and searches remain.
- Switch to another browser tab and back: the current screen does not show a loading reset and entered values remain.
- Open and close DevTools/Inspect: the current screen does not reload or reset.
