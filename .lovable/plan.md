# Fix fresh-data loading when returning to a screen

## Verified issue

- Dashboard, My NFAs, Approvals, and E-NFA Report currently rely on component-mount effects to refresh.
- Admin screens invalidate queries only in a one-time mount effect, while their tab queries explicitly disable mount refetching and remain fresh for 60 seconds.
- This makes refresh behavior dependent on whether the router actually remounts a component and whether a query is currently active, so returning to a screen can continue showing old data without a new request.

## Changes

1. **Use route entry as the refresh trigger**
   - Add a small reusable hook that detects a genuine pathname transition into a screen.
   - Trigger the screen’s refresh from that route-entry signal rather than relying only on an empty-dependency mount effect.
   - Browser focus, DevTools focus, reconnects, and in-screen tab changes will not trigger it.

2. **Apply consistent refresh behavior to every data screen**
   - Dashboard, My NFAs, Approvals, and E-NFA Report will request fresh data whenever the user leaves and later returns.
   - E-NFA Report will re-run only if the report was previously executed during the current app session; filters and visible rows remain while it refreshes.
   - User Management and SAP API Settings will refetch all screen-level query keys on route entry, including inactive-tab data, while tab switching itself remains cache-only.
   - Detail screens that already load by route ID will retain their existing behavior unless route-entry testing shows they also miss a return refresh.

3. **Preserve existing UI state**
   - Keep tabs, filters, search text, selected rows, and expanded controls unchanged while fresh data loads.
   - Keep fetched rows memory-only so they are not restored after a hard refresh or new login.
   - Do not alter SAP payloads, permissions, dialogs, forms, mutations, or backend behavior.

## Validation

- For each sidebar data screen: open it, navigate elsewhere, change source data if practical, return, and confirm a new network request occurs exactly once.
- Confirm returning preserves the screen’s selected tab, filters, search, and current visible content until the new response arrives.
- Confirm switching tabs inside User Management or SAP API Settings causes no request.
- Confirm browser-tab switching, DevTools focus, and window focus cause no request and do not close dialogs.
- Confirm hard refresh/new login does not restore fetched rows from the previous runtime.
