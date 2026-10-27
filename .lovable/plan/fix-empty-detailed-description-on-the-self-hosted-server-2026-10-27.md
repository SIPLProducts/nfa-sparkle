# Fix empty Detailed Description on the self-hosted server

## Likely cause (not yet confirmed on the server)
SAP does not store the Detailed Description. The portal saves it in its own database right after SAP accepts a new NFA. That save writes the description together with the newer fields (selected approvers, approver type, initiator, function) as one record.

If the server database is missing any of those newer columns, or has not picked them up yet, the whole save is rejected. That rejection takes the description with it. Preview and Edit then have nothing to show. The failure is only written to the browser console, so nobody sees it. Locally all the columns exist, so the save works there.

The server Print Form also shows the full 7-approver chain instead of the selected ones. That fits the same failed save, because the approver type would be lost too.

## Steps
1. Check first: run a read-only query on the server database that lists which of these columns exist in the saved-details table: approvers, approver_mode, initiator_id, initiator_name, function_name. This confirms or rules out the cause before any fix ships.
2. Make the save after creation resilient. If the full save is rejected, save again with only the original fields (subject, scope, budget, timeline, Detailed Description), so the description is never lost because of a newer field.
3. Show a visible warning when the description could not be saved at all, instead of failing silently. Creating the NFA in SAP still counts as a success.
4. Add a server check script that:
   - adds any missing columns (safe to run again, no data changes)
   - tells the database API to reload, so the new columns take effect without a restart.
5. Do not change Preview, Edit or Print Form reading or layout, SAP requests or business rules. The uploaded local PDF stays the visual reference for the expected result.

## After deploy
- Run the check script once on Quality.
- Create a new NFA with a Detailed Description (text, table, image) and confirm it appears in Preview and Edit.
- NFAs created before the fix whose description was lost cannot be recovered automatically. They need the description re-entered through Edit.

## Technical details
- `src/routes/_authed.nfa.new.tsx`: on an upsert error, retry once with the core columns only. Report a failure through the shared notification helper.
- New Quality migration `9960_draft_columns_check.sql`: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for the five columns, then `NOTIFY pgrst, 'reload schema';`. Apply it with `run-migrations.sh`.
- Add a unit test for the fallback payload builder: core fields are kept, newer fields are dropped.
