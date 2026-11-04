# Company dropdown from web Company Master

## Goal
The Company field in Create User (and Edit User, which uses the same field) lists companies from the Companies tab in User Management, not from SAP. Each entry shows as "9000 – Ramky Infrastructure Ltd".

## Changes
- Change the company list loader in User Management so it reads the Company Master through the existing guarded `listMasterItems({ kind: "companies" })` server function. It no longer calls the SAP Company F4 endpoint.
- Keep only active companies that have a code. Map each one to `{ code, name }`. Keep the server's numeric order by Company Code (1000, 1101 … 9000, 9300 …).
- The dropdown, search, "code – name" display, selected value, retry link, and saved `COMPANY_CODE` value stay the same.
- Error message changes to "Could not load companies." with Retry. If the list is empty, the dropdown shows "No companies in Company Master".

## Not changed
User fields, validations, the create/edit API payloads, the SAP integrations, and the Companies tab itself.

## Technical details
- File: `src/routes/_authed.admin.users.tsx`. Only the `useCompanyOptions` body changes. The `parseCompanyF4` import is removed if nothing else uses it.
- The server function already requires User Management access, which is the same screen that opens this dialog.
