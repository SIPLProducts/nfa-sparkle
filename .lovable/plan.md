# Remove secondary fields from the SAP Systems form

Simplify the SAP Systems tab by removing the second row of optional fields shown in the reference screenshot (System key, Label, SAP Client, Routing). Keep the database columns and server function unchanged so existing systems continue to work; only the form UI is reduced.

## What will change

- In `src/routes/_authed.admin.sap-api.index.tsx` (`SystemsTab`):
  - Remove the four-column grid that contains **System key**, **Label**, **SAP Client**, and **Routing**.
  - The main form keeps only the original two-column grid: **Environment**, **SAP Base URL**, **SAP Username**, and **SAP Password**.

## Defaults for the hidden values

Because the backend still stores these fields, the form will derive them automatically:

- **System key**: generated from the selected environment — `DEV`, `QUALITY`, `PROD`.
- **Label**: generated from the environment — `SAP DEV`, `SAP QUALITY`, `SAP PROD`.
- **SAP Client**: default to `300` (same as the current blank form).
- **Routing**: always set to `Via local middleware` (per your preference).

## What will stay the same

- The `saveSapSystem` server function and `sap_system` table schema are untouched.
- Existing systems already saved with custom keys, labels, clients, or routing keep their stored values.
- The compact **Registered systems list** still appears when more than one system exists.
- The **Test connection** and **Save SAP connection** buttons remain in the same positions.

## Outcome

The SAP Systems form will look like the first reference image: only Environment, Base URL, Username, and Password are visible, while the system keeps working through the middleware with default values behind the scenes.
