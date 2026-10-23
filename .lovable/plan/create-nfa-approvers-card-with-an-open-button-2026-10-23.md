# Create NFA: Approvers card with an "Open" button

Make the Approvers card work like the Detailed Description row: a compact card with an **Open** button that shows the approvers in a larger window of their own.

## What changes for the user

- The Approvers card keeps its title, icon and description. Below them is one row: **Approvers**, a short count such as "3 of 4 selected", and an **Open** button with an icon.
- **Open** shows a large window containing the current approver list: levels, designations, names, emails, tick boxes and loading or error messages. It also has a **Done** button.
- Ticks made in the window stay in place after closing it, and the same approvers are sent to SAP on Submit.
- The count updates as you select a Project, NFA Type and Function. Before those are chosen, the row shows the existing hint "Select Project, NFA Type and Function to see the approvers."
- Nothing else changes: approver loading, the order of approvers, Predefined/Dynamic mode, Submit and what is sent to SAP all stay the same.

Note: "separate tab" is treated as a separate window inside the page, not a new browser tab. A new browser tab cannot share the unsaved selections on this form.

## Technical details

- File touched: `src/routes/_authed.nfa.new.tsx` only. `ApproverSelector` is unchanged.
- Add `approversOpen` state. Inside the Approvers `Section`, render the same row style as Detailed Description (`rounded-md border border-border bg-muted/30 px-3 py-2.5`), with the count from `selectedApprovers.length` and an outline **Open** button (`Users` icon).
- Put `<ApproverSelector ... onChange={setSelectedApprovers} />` inside a controlled `Dialog` (`max-h-[92vh] max-w-3xl overflow-y-auto`) with a **Done** footer button.
- Use `forceMount` on the dialog's portal/content and hide it with `data-[state=closed]:hidden`, so the selector stays mounted. This keeps its internal ticks and loaded levels when the window is closed, and avoids loading the approvers again from SAP.
