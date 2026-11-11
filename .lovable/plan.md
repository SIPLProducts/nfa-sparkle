# Approval Chain Date in Print Form

## Goal
Show each approver's date (DATE1–DATE15 from the "Approval flow in Detailed Description" API) in the Print Form Approval Chain boxes, where today the date line shows "." and only "0:00:00".

## Changes
1. **Request** – keep the existing `get_data` body (`check`, `werks`, `nfa_type`, `funct`) unchanged and add `enfa_no` with the record's NFA number, for both `check = "X"` and `check = ""`, as SAP requires. Only Print Form calls send it; Create NFA calls stay as they are.
2. **Response mapping** – read `DATE{n}` for each level (1–15) and put it on that approver's date, alongside existing ACT_DATE/APPR_DATE fallbacks. Empty values stay blank.
3. **Merge** – when the saved record/SAP Select has no acted date for a level, use the Approval Chain DATE for that level; never overwrite a real acted date.
4. **Display** – show the date in the approver box as DD.MM.YYYY (e.g. 26.10.2026), matching the header Date format. Hide "0:00:00" / "." placeholders when there is no time/date. Same output in Preview, Approvals view and generated PDFs.

## Not changed
Existing payload fields, roles, user IDs, names, comments, watermark, workflow and other APIs.

## Technical details
- `src/lib/sap-approval-flow.ts`: add optional `enfaNo` to the approval-flow fetch input; parser prefers `DATE{n}` mapping into `actedDate`.
- `src/routes/api/public/sap-approval-flow.ts` + `sap-report.server.ts`: inject `enfa_no` into `get_data` template only when provided.
- Print Form preparation (`print-initiator.functions.ts` / print document builder): pass NFA number, merge date per level, format date, suppress empty time.
- Add tests: DATE1..3 mapped from the sample response; `enfa_no` added while other fields remain identical.
