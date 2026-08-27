# Rich Detailed Description: tables + inline images

Upgrade the existing Detailed Description editor (already rich text) so users can build tables and paste/resize images inline, without touching any SAP payloads, validations, or other fields.

## What changes for the user

- New toolbar group: Insert table, add/remove row, add/remove column, merge/split cells, toggle header row, delete table. Tables get visible borders, resizable columns and work inside the expanded editor too.
- Images: paste from clipboard (screenshots), drag-and-drop, or an "Insert image" toolbar button with a URL prompt. A selected image can be resized by dragging its corner handle; width is stored on the image.
- Images pasted from the clipboard are downscaled (max ~1400px wide, JPEG/PNG compression) before being embedded, to keep the note a reasonable size.
- Word/character counter, "Expand editor", placeholder and all current formatting tools stay exactly as they are.

## Where it applies

The same editor component is used on Create NFA, Change/Revise NFA, and the Report Edit dialog, so all three pick up tables and images automatically.

## What does not change

- SAP request payloads and endpoints stay identical. The SAP `TEXT` field continues to receive the plain-text conversion of the description; the table conversion will render rows as tab-separated lines and drop image markup, so SAP still receives clean text.
- Existing validations (required subject, character counts), draft save, submit, attachments and audit trail behaviour are untouched.

## Technical notes

- Add `@tiptap/extension-table` (Table, TableRow, TableHeader, TableCell) and `@tiptap/extension-image` to `src/components/RichTextEditor.tsx`; keep the existing extension list intact.
- Image resizing: wrap Image in a small custom node view (or use `ReactNodeViewRenderer`) that renders `<img>` with a drag handle updating the `width` attribute; allow `width`/`height`/`style` attributes on the node.
- Paste handling: `editorProps.handlePaste` intercepts clipboard image files, downscales via canvas, then `editor.chain().setImage({ src: dataUrl })`.
- `htmlToPlainText` gains table awareness (`</td>` → tab, `</tr>` → newline) and strips `<img>`; behaviour for existing HTML is unchanged.
- `RichTextView` (read-only preview) allow-list extended with `table, thead, tbody, tr, th, td, img, colgroup, col` and `src, width, height, colspan, rowspan` attributes, keeping DOMPurify sanitisation.
- Table/image styling added under the existing `.rich-content` CSS in `src/styles.css` using theme tokens.
