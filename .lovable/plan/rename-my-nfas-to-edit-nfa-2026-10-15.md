# Rename "My NFAs" to "Edit NFA"

## What changes

The screen keeps doing exactly what it does today — same records, same buttons, same SAP calls. Only the words shown to people change, everywhere the name appears:

1. **Sidebar** (and the phone menu, plus the hover label when the sidebar is narrowed)
2. **Page heading** at the top of the screen
3. **Browser tab title**
4. **Dashboard shortcut** tile
5. **Permission list** in User Management → Custom Roles

## What stays untouched

- The screen's address (`/nfa/my`) and every link or redirect that uses it — navigation behaviour is unchanged.
- The permission identity behind the screen, so existing role assignments and saved data keep working with no database change.
- The names of the SAP endpoints this screen uses (they are matched by name against what is configured in SAP API Settings), so Edit, Attachments, Preview and the list all still resolve to the same endpoints.
- All buttons, dialogs, search, paging and payloads.

## Verification

- Build and type-check pass.
- A controlled browser run confirms: the sidebar item reads "Edit NFA", the page heading reads "Edit NFA", the browser tab reads "Edit NFA", the Dashboard shortcut reads "Edit NFA", and the Custom Roles permission list reads "Edit NFA" — while the item still opens the same screen and the list, Edit, Attachments and Preview behave as before.

## Deployment

Frontend-only: the usual web app build and swap of the built files, then restart of the web app process. No database or SAP configuration changes.

## Technical details

Display-string edits only:

| File | Line | Change |
| --- | --- | --- |
| `src/components/AppShell.tsx` | 25 | `NAV` entry label `"My NFAs"` → `"Edit NFA"` (drives sidebar, collapsed tooltip, mobile sheet) |
| `src/lib/screens.ts` | 16 | `SCREENS` entry label → `"Edit NFA"` (`key: "nfa_my"` and `path: "/nfa/my"` unchanged; feeds the User Management permission list) |
| `src/routes/_authed.nfa.my.tsx` | 232 | `PageHeader title="My NFAs"` → `"Edit NFA"` |
| `src/routes/_authed.nfa.my.tsx` | 20, 22 | `head()` `title` and `og:title` → `"Edit NFA | NFA Portal"` (description/og:description left as-is) |
| `src/routes/index.tsx` | 253 | Dashboard `QuickAction title="My NFAs"` → `"Edit NFA"` |

Deliberately **not** changed: `ScreenKey`/permission key `nfa_my`, route file name and path `/nfa/my`, the `usesFixedRecordsViewport` pathname check in `AppShell.tsx`, and the SAP endpoint-name lookups in `src/lib/sap-report.server.ts` (`"Edit IN My NFA"`, `"MY NFA Select"`, `"Attachments In My NFA"`, `"Attached Docs In MY NFA"`, `"Display Edit Data"`), plus test descriptions and code comments that mention the old wording.
