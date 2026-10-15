# Move Approvers below Document Upload

## What changes

The Approvers card moves out of the main form area and into the right-hand column, placed directly under the "Document Attachments" upload box. Nothing else on the Create NFA page moves or changes.

```text
Before                                   After
---------------------------------        ---------------------------------
| Organisation & Type       | | Up |    | Organisation & Type       | | Up |
| Approvers                 | |loa |    | Note Details              | |loa |
| Note Details              | |d   |    |                           | |d   |
-----------------------------          ---------------------------------
                                         | Approvers                 |
```

## Scope

- One file: the Create NFA page (`src/routes/_authed.nfa.new.tsx`). The Approvers card markup is cut from its current position and pasted below the upload card in the same column.
- The approver picker component, its props, its data loading, and the Submit / Print Form payloads are untouched — the card is relocated as-is, so ticking approvers, the numbered "Selected sequence" list, and every SAP call behave exactly as now.
- No database, migration, or SAP endpoint changes. This is a frontend-only deployment.

## Behaviour kept intact

- Approvers still only appear once Project, NFA Type and Function are chosen, and still list the configured Approval Chain in its set order with Level, Designation, User ID and Email ID.
- Unticking an approver still removes it from the selected sequence and from the routing/Print Form data.
- On smaller screens the page stacks in one column and Approvers now appears last, after the upload box.

## Note on width

The right-hand column is about one third of the page width, so the approver table will be tighter than it is today. The table already scrolls sideways inside its own frame when space runs short, so no fields are hidden or cut off — you may need a small sideways swipe to reach the Email ID column.

## How it is checked

- Type-check and build pass with no new errors.
- A controlled browser run confirms the card renders under the upload box, and that ticking/unticking an approver still updates the "Selected sequence" list.
