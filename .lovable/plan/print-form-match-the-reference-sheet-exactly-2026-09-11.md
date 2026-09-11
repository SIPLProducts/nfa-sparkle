# Print Form — match the reference sheet exactly

## What changes for the user

The Print Form (Create, Edit, Approvals and the "Formatted document" preview) is
re-laid-out so it looks like the reference `ENFA-100068` sheet instead of the
current oversized web-style card.

**Layout corrections**

```text
+------------------------------------------------------------------+
|            Ramky Estates & Farms Ltd            [logo, right]     |
+------------------------------------------------------------------+
|                    NOTE FOR APPROVAL   (grey band, centred)       |
+------------------------------------------------------------------+
| NFA No: 100068 / REFL - Head Office            Date: 24.08.2026   |
| Initiator: SIPL                                                   |
| NFA Type: Budget Deviation                                        |
| Function: Projects                                                |
| Sub: test2                                                        |
| Scope Impact: test                                                |
| Timeline Impact: 46 (Days)                                        |
| Budget Impact: Rs.100,000.00 (Lakhs)                              |
+------------------------------------------------------------------+
| DETAILED DESCRIPTION  (rich text, tables, images)                 |
+------------------------------------------------------------------+
| Role: DIRE-PROJ | Role: CFO        | Role: REG. HEAD              |
| User id: ...    | User id: ...     | User id: ...                 |
| Mareddy Suresh  | ABAPER Narender  | Ranjit Kumar Neela           |
| date / time     | date / time      | date / time                  |
+------------------------------------------------------------------+
| Current Version Comments:                                         |
|   Name — comment (one block per approver)                         |
+------------------------------------------------------------------+
```

Specifically:
- Company name centred and bold, logo pinned right, one outlined header box.
- "NOTE FOR APPROVAL" as a shaded centred band, not a large tracking-wide title.
- Header labels bold, values normal, all on single compact lines; the Date sits
  right-aligned on the same line as NFA No. Each label/value pair is one row of
  the same table so nothing shifts when a value is long.
- Small serif print type (about 8–9 pt), tight row padding, thin black rules —
  matching the reference density rather than today's roomy 13 px rows.
- Approver boxes: fixed 3-per-row grid with Role / User id / Name / acted date /
  time, borders on all sides, empty cells kept so the grid stays square.
- New "Current Version Comments" band listing each approver name with the
  remark they entered, taken from the record's stored approval comments. If no
  comments exist the band is omitted rather than showing blanks.
- The Detailed Description keeps its own bordered band; long tables, pasted
  images and Word/Excel content are width-clamped so they can never push the
  header or approver sections out of alignment.

**Printing** — A4 with the same proportions on paper as on screen, table rows
never split across pages, dialog chrome hidden.

Everything else — Create, Edit, Approve, Reject, Clarification, validations,
attachments, SAP payloads and APIs — stays exactly as it is.

## Technical notes

- `src/components/document/EnfaDocument.tsx` rewritten as a single bordered
  table-based sheet: header row, title band, field rows (NFA No + Date share a
  2-column row), description band, approver grid, comments band. Font size and
  padding move to the `.enfa-doc` scale in `src/styles.css` so screen and print
  agree; no new props are required by existing callers.
- New optional props: `approvers[].actedAt` (date + time lines) and
  `comments?: { name: string; text: string }[]`, both defaulted so current call
  sites keep compiling.
- Callers pass what they already have: `_authed.approvals.tsx` and
  `RecordPreviewDialog.tsx` read optional `USERn` / `UIDn` / `PERNRn` keys from
  the SAP row for the User id when present (blank otherwise), and load
  `nfa_approver` (`designation`, `comment`, `acted_at`) for the matching record
  to fill the comments band. `RecordEditDialog.tsx` and `_authed.nfa.new.tsx`
  pass the same shape; Create simply has no comments yet.
- `src/styles.css`: `.enfa-doc` gets the compact serif print scale, black hairline
  borders, shaded title/approver header cells, `max-width:100%` clamping for
  `.rich-content` tables and images inside the document, and the `@page A4`
  block extended with `break-inside: avoid` on approver/comment rows.
- No API, schema, workflow or SAP payload changes.
