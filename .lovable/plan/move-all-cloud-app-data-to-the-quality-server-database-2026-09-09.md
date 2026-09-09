# Move all cloud app data to the Quality server database

Copy everything currently in the online app's database into the Quality Supabase running on your server, so the Quality site behaves exactly like the online one.

## What gets copied

Current contents of the online database:

| Data | Rows |
| --- | --- |
| Login accounts + profiles | 10 |
| Roles / role definitions / screen permissions | 11 / 4 / 28 |
| SAP system, endpoints, connection, middleware, stored SAP passwords | 1 / 23 / 1 / 1 / 2 |
| NFA records, approvers, history, attachment entries | 37 / 32 / 64 / 21 |
| SAP record drafts | 2 |

Login passwords are carried over as-is (the encrypted values are copied), so every user signs in on the Quality server with the same User ID / Email and password they use today.

Uploaded attachment files themselves live in file storage, not the database. The attachment list is copied; the actual files are handled separately (see Open point).

## How it will work

1. A single generated file `deployment/Quality/backend/migrations/9000_data_import.sql` is produced from the live online database. It contains literal rows — no manual retyping.
2. Because you chose **Replace**, the file first clears the same tables on the Quality database (only those tables, in dependency order), then inserts the copied rows.
3. Login accounts are inserted into the authentication tables first (account + identity + encrypted password), then profiles, roles and permissions, then SAP configuration, then NFA data. The automatic "new user" trigger is switched off while accounts load, so it can't create duplicate profiles, and switched back on at the end.
4. The file is safe to re-run: rerunning simply replaces the same tables again with the same content.
5. `deployment/README.md` gets a short section: copy the file to the server, then run the existing `scripts/run-migrations.sh`. Nothing else changes — no other application, container, port or volume is touched.

## Order used when clearing and loading

```text
clear:  nfa_attachment_view, nfa_attachment, nfa_audit, nfa_approver, nfa,
        approval_chain_level, approval_chain, sap_record_draft, sap_secret,
        sap_endpoint, sap_system, sap_connection, sap_middleware_config,
        role_permission, user_role_assignment, user_roles, profiles,
        auth.identities, auth.users
load:   the same list in reverse
```

## Technical details

- Rows are read from the online database and written as explicit `INSERT ... VALUES` statements, wrapped in one transaction.
- `auth.users` columns copied include `id`, `email`, `encrypted_password`, confirmation timestamps and `raw_user_meta_data`; `auth.identities` rows are copied so email sign-in resolves. Password hashes are bcrypt and are portable across the same GoTrue major version, which is what the Quality stack runs.
- The `on_auth_user_created` trigger is disabled with `ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created` for the duration of the load.
- Sequences are not involved (all keys are UUID or natural text keys).
- No application source code changes.

## Prerequisite

The Quality database schema must already be in place — that is, the existing migration files must have run successfully. The current `supabase_admin` password problem must be cleared first with `scripts/fix-db-roles.sh`, otherwise the import cannot connect.

## Open point

The 21 attachment entries point at files in the online file storage bucket `nfa-attachments`. If those files also need to exist on the Quality server, tell me and I will add a download/upload step; otherwise the records are copied and the files stay where they are.
