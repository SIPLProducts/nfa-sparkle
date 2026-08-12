# SAP Systems tab — inline connection form

Rework the **SAP Systems** tab so it opens with the same simple connection form as the old SAP Connection screen, with a compact list of registered systems underneath.

## Layout

1. **Active SAP System card** (top, matches the reference image)
   - Title "SAP Connection" style header with a **Test connection** button on the right.
   - Two-column grid of fields:
     - Environment (DEV / QUALITY / PROD dropdown)
     - SAP Base URL — single field, e.g. `http://10.150.150.154:8103`
     - SAP Username
     - SAP Password (write-only; shows a "set" badge, blank keeps the existing one)
   - Optional small fields kept on one line under the grid: System key, Label, SAP Client, Routing (via middleware / direct).
   - **Save SAP connection** button bottom-right.
   - When no system exists yet, the form is empty and saving creates the first system and marks it Active.

2. **Registered systems list** (below the form)
   - Compact rows: label + environment badge, base URL, Active pill, and Make active / Edit / Test / Delete actions.
   - Selecting a row loads it into the form above; an **Add system** button clears the form for a new entry.
   - Hidden entirely when only one system exists, so the screen looks exactly like the reference.

## Behaviour

- Base URL is parsed into protocol / host / port / base path when saved, so the existing storage, endpoint resolution and middleware routing keep working unchanged.
- Test connection uses the current form values for a saved system, same as today.
- Only one system is Active; endpoints with a relative path follow it.

## Technical notes

- All changes in `src/routes/_authed.admin.sap-api.index.tsx` (`SystemsTab`): replace the card grid + dialog with the inline form plus a list; no database or server-function changes.
- Add a small `parseBaseUrl()` / `buildBaseUrl()` helper to map between the single URL field and the `protocol`/`host`/`port`/`base_path` columns of `sap_system`.
- Existing `saveSapSystem`, `activateSapSystem`, `deleteSapSystem`, `testSapSystem` server functions are reused as-is.
