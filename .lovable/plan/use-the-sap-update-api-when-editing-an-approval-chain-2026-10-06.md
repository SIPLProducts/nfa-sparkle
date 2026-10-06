# Use the SAP Update API when editing an Approval Chain

## What changes for you
- **Add chain** keeps sending `create_user` (SAP replies "Data Inserted Successfully").
- **Edit** → Save now sends `Update_user` with the same fields (SAP replies "Data Updated Successfully").
- Both go to the same SAP service configured as **Create Approvals** (`/e-nfa/enfa_approval/APPROVAL`, PUT). Its address, method, login and SAP system all come from SAP API Settings, so nothing is hardcoded.
- SAP's reply is shown as the message. After a successful save the list reloads from SAP. If SAP rejects the save, its error is shown and your edits stay open.
- Delete, the chain list, and every other screen stay as they are.

## Update payload (exactly your sample format)
`{ "Update_user": { pspnr, Funct, EXTR_TXT, BEGDA, endda, DESIG1..7, USERID1..7, LINE_INDEX } }`
- Values come from the edited chain loaded from SAP, including its LINE_INDEX. Unused slots are sent as "".

## Technical details
- `src/lib/sap-approval-chain.ts`: add the operation `"update"` to `buildApprovalChainPayload`, which wraps the fields in `Update_user` and runs the same validation as save.
- `src/components/admin/ApprovalChainTab.tsx`: on save, use `"update"` when `editingIndex !== null`, otherwise `"save"` (create).
- No server or permission change: the existing management route forwards any payload object to the Create Approvals endpoint and requires User Management.
- Add a test for the exact Update sample payload and the "Data Updated Successfully" response.
- The company server needs the new web build deployed and the app process restarted.
