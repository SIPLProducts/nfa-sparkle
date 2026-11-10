# Why the Rejected NFA shows DRAFT

## Finding
- The report shows NFA 100265 with ENFA Status "Rejected" (field `STATUS_TXT`).
- The Preview reads the same field. In the current code, "Rejected" becomes the REJECTED watermark.
- Your screenshots come from **enfa.siplproducts.com (Production)**. The Rejected fix was made after the last Production deployment, so Production still runs the old rule: "everything except Approved = DRAFT".

## What to do (no code change needed)
1. Copy the updated `src/lib/print-form-status.ts` to the Production server (also Quality if you want it there).
2. Rebuild and restart the Production app with the usual Production deploy script, then restart the app process with PM2.
3. Hard-refresh the browser (Ctrl+Shift+R), open E-NFA Report, filter on Rejected, select 100265 and click Preview. The watermark should say REJECTED.

## If it still shows DRAFT after redeploy
Next step is a code check: confirm the Preview gets the selected row's status. That would be a separate fix.
