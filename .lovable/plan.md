# Dynamic Approval Chain management

## Build
- Keep the existing User Management → Approval Chain tab and replace its read-only SAP list with editable chain rows.
- Load approval chains from the configured SAP Approval Chain service, preserving project, function, validity dates, line index, designations, and user IDs.
- Allow administrators to add, edit, reorder, and remove approval levels, and create or delete a chain without creating another tab.
- Save the complete current level list through the existing configured SAP endpoint using the `create_user` payload. Populate `DESIG1…7` and `USERID1…7` from the edited rows and clear unused slots; do not hardcode business values.
- Show SAP success and rejection messages through the existing SweetAlert notification layer, and keep unsaved edits available if SAP rejects the request.

## Safety and verification
- Keep existing user creation, roles, permissions, NFA workflows, and SAP endpoint settings unchanged.
- Validate required chain fields, paired designation/User ID values, duplicate users, and the SAP service’s seven-level contract before saving.
- Add focused payload/parser tests, run them, verify the build, and exercise the existing Approval Chain tab in the preview when an administrator session is available.
