# Remove the Project field from Create NFA

## Goal
Remove the Project dropdown completely from the Create NFA screen (`/nfa/new`) without touching any other field, API, validation, or functionality.

## Changes (all in `src/routes/_authed.nfa.new.tsx`)

1. **Remove the Project dropdown UI** — delete the `<Field label="Project">` block (lines ~570-573), including the `Select` bound to the `project` state and the "Select plant first" placeholder. The remaining Organisation & Type fields (Company, NFA Type, Plant, Function) stay exactly as they are; the grid layout will reflow naturally.

2. **Remove the `project` state** — delete `const [project, setProject] = useState("")` and the now-unused `projectsFor` import.

3. **Load Sample** — remove the `setProject("P002")` line so the sample loader continues to work without the removed state.

4. **Save / Submit insert** — drop `project: project || null` from the `nfa` insert payload. The database `project` column is nullable, so the insert still succeeds with the column unset; no schema change needed.

## What stays untouched
- All other fields, the SAP F4 lookups (company, plant, NFA type, function), Save / Submit for Approval flows, SAP create call, approver chain, attachments, and validation rules — no behavior changes.
- The `PROJECTS` master data in `src/lib/sap/master.ts` and the `project` column in the database are left in place (harmless, and avoids affecting other screens).

## Verification
- TypeScript typecheck passes.
- Open `/nfa/new` in the preview and confirm the Project dropdown is gone, Load Sample works, and Save/Submit still create the NFA.
