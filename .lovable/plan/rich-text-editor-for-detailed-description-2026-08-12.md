# Rich text editor for Detailed Description

Replace the plain textarea with a Word-like editor offering bold, italic, underline, strikethrough, headings/font size, text colour-free basic styling, alignment (left/center/right/justify), bullet and numbered lists, indent, blockquote, horizontal rule, link, and undo/redo.

## What changes for the user

- **Create NFA screen**: the Detailed Description box gets a toolbar above it. The expand-editor dialog uses the same editor full-size.
- **Change request screen**: same editor when revising the description.
- **NFA detail screen**: the description renders with its formatting (bold, lists, alignment) instead of raw text.
- Word/character counters keep working, based on the visible text.
- Existing plain-text descriptions continue to display correctly — they are treated as paragraphs.

## Technical notes

- Add TipTap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-text-align`, `@tiptap/extension-link`, `@tiptap/extension-text-style` + `@tiptap/extension-font-size` for size presets).
- New component `src/components/RichTextEditor.tsx`: controlled `value`/`onChange` HTML string, toolbar built from existing shadcn `Toggle`/`Button`/`Select` primitives and design tokens (no hardcoded colours), SSR-safe (`immediatelyRender: false`).
- New component `src/components/RichTextView.tsx`: renders stored HTML read-only. Sanitize with a small allowlist sanitizer (add `dompurify`) before `dangerouslySetInnerHTML`.
- Storage: keep the existing `nfa.detailed_description` text column; store HTML. Legacy plain text is detected (no `<`) and rendered as pre-wrapped paragraphs.
- Add a `.rich-content` prose style block in `src/styles.css` so lists, headings and alignment render correctly in both editor and read view.
- Files touched: `src/routes/_authed.nfa.new.tsx`, `src/routes/_authed.nfa.$id.change.tsx`, `src/routes/_authed.nfa.$id.tsx`, `src/styles.css`, plus the two new components.
