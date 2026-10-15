# Show Email ID beside User ID in the Approval Chain tab

## What changes for you
- User Management → Approval Chain: every chain table gets a new **Email ID** column right after **User ID**.
- The email comes from that user's account in User Management, matched by User ID. Nothing is hardcoded and nothing is sent to or stored in SAP.
- In Add/Edit chain, each level shows the matching Email ID as read-only text under the User ID box. It updates as you type a User ID.
- If no user matches the User ID, it shows "—".
- Search also matches email addresses.
- Saving, deleting, reordering and the SAP payloads stay exactly the same.

## Technical details
- New server function `resolveApprovalUserEmails(userIds)` in `src/lib/approval-chain.functions.ts`, behind `requireSupabaseAuth` and User Management access. It reads `profiles.username, email` with the admin client, matches usernames case-insensitively, and returns a `{ USERID: email }` map. Deleted profiles are excluded.
- `ApprovalChainTab.tsx`: after loading chains, collect the unique User IDs and call the resolver once, keeping the map in state. In the editor, look up again (debounced) for any new IDs. Render the column and helper text from the map.
- No database change. No changes to `sap-approval-chain.ts` payloads or other screens. Frontend-only deploy.
