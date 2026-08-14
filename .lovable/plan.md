# Remove placeholder text from Detailed Description field

Remove the placeholder text from the **Detailed Description** field on the **Create NFA** screen so the editor starts empty by default.

## What changes for the user

- The **Detailed Description** rich text editor on `/nfa/new` no longer displays any placeholder text when empty.
- The expanded editor dialog for the same field also starts empty.
- The word/character counter and other behaviour remain unchanged.

## Technical notes

- File touched: `src/routes/_authed.nfa.new.tsx`.
- Remove the `placeholder` prop from the inline `<RichTextEditor>` (around line 249-254) and from the expanded dialog's `<RichTextEditor>` (around line 267).
- No changes to the `RichTextEditor` component itself; it already supports empty placeholder.
