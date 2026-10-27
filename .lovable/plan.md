# Deployment steps for today's four fixes

Today's fixes:
- Selected approvers shown in Preview
- Detailed Description saved and shown in Preview and Edit
- Approver names shown in comments
- ENFA number shown in the Dynamic Approvers tab

What needs deploying: **one database update** and **the frontend**. The middleware is not affected; do not touch it.

## 1. Database (Studio SQL Editor, http://10.200.1.7:8082)
1. Open the SQL Editor.
2. Paste the contents of `deployment/Quality/backend/migrations/9960_draft_columns_check.sql`, then click Run.
3. Expected result: "Success. No rows returned". It is safe to run more than once and changes no existing data.
4. Optional check: run the query below. It should list all 5 columns: approvers, approver_mode, initiator_id, initiator_name, function_name.
   ```sql
   select column_name from information_schema.columns
   where table_name = 'sap_record_draft'
     and column_name in ('approvers','approver_mode','initiator_id','initiator_name','function_name');
   ```

## 2. Build the frontend (on your Windows PC)
```text
cd <project folder>
npm install
npm run build
```
This creates a fresh `dist` folder.

## 3. Back up and upload (WinSCP)
1. On the server, go to `/apps/webapplications/NFA_Approval/Quality/frontend/`.
2. Rename the current `dist` to `dist_backup_27oct`. Do not delete it.
3. Upload the new `dist` folder into the same place.
4. Do not overwrite or delete the `.env` file in that folder.

## 4. Check the server settings (PuTTY)
```text
cd /apps/webapplications/NFA_Approval/Quality/frontend
grep -c "SUPABASE_SERVICE_ROLE_KEY=ey" .env
```
- `1` means the key is set. Continue.
- `0` means the key is missing or is still placeholder text. Add the real key before restarting. Without it, some saves and emails fail silently.

## 5. Restart the app (PuTTY)
```text
pm2 restart enfa-quality-app --update-env
pm2 status
curl -I http://127.0.0.1:8081/auth
```
Expected result: `enfa-quality-app` shows **online**, and the curl command returns **HTTP/1.1 200**.

## 6. Test in the browser (press Ctrl+F5 first)
1. **Dynamic Approvers tab:** each card shows "NFA <number>", not "NFA —".
2. **Create NFA:** pick Dynamic Approvers (for example 3 approvers) and enter a Detailed Description with text and a table. Then submit.
3. **Preview of that NFA:** only the 3 selected approvers appear, and the Detailed Description is filled in.
4. **Edit NFA:** the Detailed Description appears.
5. **Comments:** after an approval, Preview comments show names, or User IDs, instead of "Approver 1".

## Rollback (if something breaks)
```text
cd /apps/webapplications/NFA_Approval/Quality/frontend
mv dist dist_failed && mv dist_backup_27oct dist
pm2 restart enfa-quality-app --update-env
```
There is no need to undo the database update. It only adds empty columns.
