# Align the E-NFA Report request payload and response with SAP

## What changes

**1. Request payload gets the missing SAP keys**

The Report call currently sends 15 keys. SAP now expects 18, in this exact order and spelling:

```text
user_name, plant_from, plant_to, funct_from, funct_to, nfano_from, "nfano_to ",
extra_from, "extra_to ", dat_from, dat_to, usrid_from, usrid_to,
r_proc, r_comp, r_reje, r_init, r_clar
```

- `user_name` is filled server-side from the SAP credentials registered for the Report endpoint (uppercased, e.g. `SIPL_QM`) — same way the Edit/Detail call already does it. It is never taken from the browser.
- `r_comp` loses the trailing space it currently carries (SAP's sample sends plain `r_comp`); `nfano_to ` and `extra_to ` keep their trailing space exactly as SAP sends them.

**2. "Back to Initiator" and "Requested Clarification" become real SAP filters**

Today those two checkboxes only filter the rows already returned, on the client. They will now set `r_init` = `X` and `r_clar` = `X` in the request payload so SAP does the filtering, matching the other three status checkboxes. The client-side post-filter for those two is removed so results are not double-filtered.

**3. Response display**

The sample response fields (`REFFLD`, `PSPNR`, `NAME1`, `FUNCT_TXT`, `EXTR_TXT`, `SUBJECT`, `INIT_NAME`, `BEGDA`, `ROLE1..6`, `APPR1..6`, `STAT1..6`, `STATUS_TXT`) are all already mapped in the results table, so no column changes are needed. The one adjustment: the status badge colour mapping gains a case for "With initiator" so that status is styled instead of falling through to the plain grey default.

## Technical notes

- `src/lib/sap-api-constants.ts` — extend `REPORT_WIRE_KEYS` with `r_init` / `r_clar`, drop the trailing space on `r_comp`, and let `wrapReportPayload` accept an optional `user_name` that is emitted first.
- `src/lib/sap-report.server.ts` — add `r_init`, `r_clar` to `REPORT_KEYS` (so `buildReportPayload` passes them through), and in `callEnfaReport` resolve the endpoint username and inject it as `user_name`.
- `src/routes/_authed.report.tsx` — add `r_init` / `r_clar` to the `EMPTY` filter object, bind the two checkboxes to them via the existing `flag` helper, and remove the client-side `extraStatus` filtering.
- No change to Edit, Preview, Upload, Attachments, CSV export, screen-state caching or refresh behaviour.
