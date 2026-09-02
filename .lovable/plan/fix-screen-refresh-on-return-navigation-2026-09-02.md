# Fix screen refresh on return navigation

## Verified current state

- A refresh-on-entry mechanism already exists: `useScreenEntryEffect` (`src/hooks/use-screen-entry-effect.ts`) fires when a screen's pathname becomes active, and Dashboard (`src/routes/index.tsx`), My NFAs (`_authed.nfa.my.tsx`), Approvals (`_authed.approvals.tsx`), E-NFA Report (`_authed.report.tsx`), User Management (`_authed.admin.users.tsx`), and SAP API Settings (`_authed.admin.sap-api.index.tsx`) all call it.
- The hook has a 500 ms de-dupe window per screen (`lastEntryAt`), which can silently skip a legitimate re-entry when the user leaves and returns quickly.
- Report only refreshes if a report was previously run (`if (ran)`); Dashboard/My NFAs/Approvals refresh in the background keeping cached rows visible.
- Admin screens invalidate their query keys on entry with `refetchType: "all"`.
- `src/router.tsx`: `refetchOnMount: true`, focus/reconnect refetch disabled.

## Plan

1. **Reproduce first (diagnosis step)**
   - Drive the live app in the browser: for each sidebar screen (Dashboard, My NFAs, Approvals, E-NFA Report, User Management, SAP API Settings), navigate away and back while watching network requests.
   - Identify exactly which screens fail to issue a fresh API call on return, so the fix targets the real gap rather than guessing.

2. **Fix the entry trigger so it never misses a genuine re-entry**
   - In `useScreenEntryEffect`, replace the time-based 500 ms de-dupe with a mount/re-entry based trigger: fire once whenever the route becomes active after having been inactive (or on first mount), with no time window that can swallow a real navigation.
   - Guarantee exactly one refresh per navigation into a screen — no double-fires on the same entry.

3. **Apply to any screen found missing a refresh in step 1**
   - Add or correct the `useScreenEntryEffect` wiring (or query invalidation) on any data screen that shows stale data on return, using the same pattern already in place.

4. **Preserve existing behavior**
   - Background refresh: current rows, filters, search text, selected tab/record, and pagination stay visible and unchanged while fresh data loads; no loading flash when cached data exists.
   - No changes to API payloads, SAP integration, validation, permissions, or UI styling.
   - No refresh on browser-tab switch, window focus, or in-screen tab switching.
   - Data remains memory-only: a hard refresh or fresh login still fetches from scratch.

## Validation

- For each data screen: open it, navigate away, return — exactly one fresh network request fires and rows update.
- Return within a second of leaving: refresh still fires (no skipped re-entry).
- Filters, search, selected tab/record, and open dialogs are preserved through the refresh.
- In-screen tab switches (User Management, SAP API Settings) trigger no requests.
- Browser-tab switch / window focus triggers no requests.
- Hard refresh starts empty and fetches from scratch.
