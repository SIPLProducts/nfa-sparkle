# Add a merge-safe User Management data migration

## What will be delivered

Create one new SQL file in `deployment/Quality/backend/migrations/` containing the complete current User Management data from the online portal:

- 10 login accounts and their password hashes/identity records
- 10 user profiles, including User ID, name, email, contact, status, company, department, and employee/company-name fields
- 11 assigned system roles
- 4 role definitions
- 28 screen-permission rows
- Custom role assignments, when present
- Approval chains and their levels, when present

The online database currently has no custom role assignments or approval-chain rows, so those sections will be included but contain no inserts unless data appears when the file is generated.

## Merge behavior

The file will preserve existing Quality users rather than deleting them:

- Match accounts by user ID first, then by case-insensitive email.
- Update matching online accounts, profiles, identities, roles, and permissions with the current online values.
- Insert online records missing from Quality.
- Keep Quality-only users and their related records untouched.
- Remap imported profile and role rows to an existing Quality account when the same email already exists under a different internal ID, avoiding duplicate-email failures.
- Temporarily disable the new-user trigger only while account rows are merged, then always restore it before the transaction completes.
- Make the migration rerunnable through conflict-safe inserts/updates.

## Safety and deployment

- Put all operations in one transaction and stop on the first SQL error.
- Do not clear NFA, SAP, attachment, or other application data.
- Do not include readable passwords; only the existing encrypted authentication hashes are transferred.
- Do not expose account or password data in documentation or chat output.
- Add concise instructions to `deployment/README.md` for copying the file and running the existing `scripts/run-migrations.sh` command.
- Keep the existing full replacement file `9000_data_import.sql` unchanged; the new file is specifically for merge-safe User Management transfer.

## Verification

After generating the file:

1. Check that every imported login has a matching profile and identity.
2. Check role, permission, custom-role, and approval-chain row totals against the online database snapshot.
3. Confirm the script contains no deletes from user-management or authentication tables.
4. Validate the transaction and conflict-handling SQL without changing the online database.
