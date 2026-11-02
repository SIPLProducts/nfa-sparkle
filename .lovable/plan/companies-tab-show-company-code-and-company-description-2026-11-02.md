# Companies tab: show Company Code and Company Description

## What changes (Companies tab only)
- Create / Edit company window: fields in order **Company Code**, **Company Name** *, **Company Description**.
- Companies table: columns **Company Code**, **Company Name**, **Company Description**, Actions.
- View window: same three labels.
- Existing 58 companies already have their code saved, so the Company Code column fills in immediately.

Departments and Designations stay exactly as they are.

## Technical details
- `MasterListTab`: add optional `codeLabel` (default "Code") and `descriptionLabel` (default "Description") props, used in table header, view and form; place code before name when shown.
- `_authed.admin.users.tsx` Companies tab: `showCode={true} codeLabel="Company Code" descriptionLabel="Company Description"`.
- No database change (code and description columns already exist).
