# Create NFA: Detailed Description as an "Open" row

Change the Detailed Description on the Create NFA screen to look and work like it does in the Edit NFA window.

## What changes for the user

- The large editor that is always open is replaced by a small row: **Detailed Description** on the left and an **Open** button (with a document icon) on the right. It uses the same rounded, lightly shaded box as in Edit NFA.
- **Open** shows a large window with the same full editor: bold, headings, alignment, lists, tables, images, undo and redo. It also has a **Done** button.
- Text you type stays saved after you close the window. Opening it again shows the same text.
- Nothing else changes: other fields, the layout, Submit, attachments, approvers and what is sent to SAP stay the same.

## Technical details

- File touched: `src/routes/_authed.nfa.new.tsx` only.
- Replace the inline `RichTextEditor` and the "Expand editor" dialog (around lines 614–636) with:
  - a `div` row using `flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5`, with the label text and an outline `Button` with a `FileText` icon labelled "Open";
  - a controlled `Dialog` (new `descOpen` state) styled `max-h-[92vh] max-w-4xl overflow-y-auto`, containing `RichTextEditor value={desc} onChange={setDesc} minHeight="45vh"`, plus a footer **Done** button that closes it.
- The `desc` state, the `htmlToPlainText` conversion and the SAP `TEXT` payload stay as they are.
- Add the `FileText` import from lucide-react if needed. Remove the `Maximize2` import only if nothing else uses it.
