
# Note For Approval (NFA) — Web Application

Build the full UI and workflow front-end now. All NFA data and master data (Company, Project, NFA Type, Function, Approvers) will come from SAP via APIs you'll provide later. We'll wire a thin server adapter layer with mock data behind it so screens are fully usable today and switch to SAP by swapping one module when the APIs are ready.

## Scope (v1)

Four modules matching your screenshots:
1. **NFA Creation** — Note For Approval form
2. **NFA Changes** — Worklist of own NFAs (With Initiator / Clarification) + edit
3. **NFA Approval** — Approver inbox with Approve / Reject / Back To Initiator / Clarification
4. **E-NFA Report** — Filter screen + results grid

Plus: Login, role-based navigation, attachments, preview, audit trail.

## Pages & Navigation

```text
/auth                       Login / Sign-up
/                           Dashboard (tiles: Create, My NFAs, Approvals, Report)
/nfa/new                    NFA Creation form
/nfa/my                     My NFAs (worklist – "NFA Changes")
/nfa/:id/edit               Edit NFA (only while With Initiator / Clarification)
/nfa/:id                    Preview / detail (read-only)
/approvals                  Approver inbox
/approvals/:id              Approve detail with action bar
/report                     E-NFA Report (filters + grid)
/admin/users                Admin: assign roles
```

## NFA Creation form (matches screenshot 1)

Fields: Company (dropdown), Project (search + code/name), NFA Type (dropdown), Function (search), Subject, Scope Impact, Budget Impact (Lakhs, number), Timeline Impact (Days, number), Detailed Description (rich textarea modal), Attachments (multi-file).
Actions: Save Draft, Submit for Approval.

## Worklists & Detail

- **My NFAs** grid columns: ENFA Number, Status, Plant, Plant Name, NFA Type, Creation Date, Approver1..6 + Status1..6. Toolbar: Edit, Upload File, Attached Docs, Preview. Filter/sort/export to Excel.
- **Approvals inbox** columns: ENFA No, Plant, Plant Name, NFA Type, Date, Subject. Toolbar: Preview, Attached Docs, Approve, Reject, Back To Initiator, Clarification (with comment dialog), User Manual link.
- **Preview**: read-only printable view of the NFA + approval trail timeline.

## E-NFA Report (matches screenshot 4 & 5)

Filters: Plant from/to, ENFA Type, ENFA No, Function, Date Range, Approver IDs, status checkboxes (In Process / Completed / Rejected). Run → grid with all columns from screenshot 5 (ENFA Status, Designation1..6 / Approver1..6 / Status1..6). Export to Excel.

## Roles

- **Initiator** — create/edit own NFAs while With Initiator/Clarification, submit, upload docs.
- **Approver** — see assigned items in inbox, Approve/Reject/Back/Clarification.
- **Admin** — assign roles to users.
- **Viewer** — read-only Report.

Roles stored in a separate `user_roles` table with a `has_role` security-definer function (best practice). Login via email/password + Google.

## SAP Integration Strategy (UI-first, swap later)

Create a single server module `src/lib/sap/` exposing a typed interface:

```text
listCompanies(), listProjects(q), listNfaTypes(), listFunctions(q),
listApprovers(nfaId)
listMyNfas(filters), listApproverInbox(userId), getNfa(id), createNfa(payload),
updateNfa(id, payload), submitNfa(id), actOnNfa(id, action, comment),
runReport(filters), uploadAttachment(id, file), listAttachments(id)
```

Two implementations behind the same interface:
- `mock.ts` — used now. Seeds dropdowns and a few sample NFAs so every screen works end-to-end.
- `sap.ts` — stub with TODOs for each SAP endpoint. When you share the SAP base URL, auth (OAuth/OData/Basic), and per-call paths, we plug them in here and flip an env flag `SAP_MODE=live`. No screen code changes.

All SAP calls go through TanStack Start server functions (keeps SAP creds server-side, avoids CORS).

## Attachments

Stored in Lovable Cloud Storage (private bucket `nfa-attachments`) keyed by NFA id, until SAP DMS endpoints are provided. Upload, list, download, inline PDF/image preview.

## Data Model (Lovable Cloud, used until SAP cuts over)

- `nfa` — id, enfa_number, company, plant, plant_name, project, nfa_type, function, subject, scope_impact, budget_impact, timeline_days, detailed_description, status (`with_initiator|in_process|clarification|completed|rejected`), initiator_id, created_at, updated_at.
- `nfa_approver` — nfa_id, level (1–6), approver_id, designation, status (`pending|approved|rejected|sent_back`), acted_at, comment.
- `nfa_attachment` — nfa_id, path, filename, size, uploaded_by, uploaded_at.
- `nfa_audit` — nfa_id, actor_id, action, comment, at.
- `user_roles` — (user_id, role enum: initiator/approver/admin/viewer).

All tables: explicit `GRANT` + RLS so users see only their own NFAs, approvers see only those assigned to them, admins/viewers as appropriate.

## Design

Clean enterprise look (matches the SAP-style screenshots): light blue-grey background, dense data tables, clear action toolbars, accessible focus states, responsive down to tablet. Not the generic purple-gradient AI aesthetic.

## Out of Scope (v1)

- Live SAP calls (stubs only — turned on when you share APIs/creds).
- Mobile-native app.
- Email/SMS notifications (can add once SMTP/SAP notifier is decided).

## Next step from you (when ready)

Share SAP API docs / sample endpoints / auth method for: master data dropdowns, NFA CRUD + submit, approver actions, report, and attachments. I'll wire `sap.ts` to them.
