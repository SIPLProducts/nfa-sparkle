# Remove word/character count and limits from Detailed Description

Remove the word and character counters shown below the **Detailed Description** rich text editor, and ensure the field has no length validation or input limit. All other functionality, API payloads, and validations must stay unchanged.

## What changes for the user

- The **Create NFA** screen no longer shows "X words · Y characters" under the Detailed Description editor (both inline and expanded dialog).
- The **Report Edit dialog** no longer shows "X characters" / "Not filled in yet" for Detailed Description.
- Detailed Description accepts unlimited text input.
- Existing required-field validation (subject, etc.), SAP plain-text conversion, attachments, draft/submit behaviour, and UI layout remain untouched.

## Technical notes

- Files touched:
  - `src/routes/_authed.nfa.new.tsx`: delete the word/character count `<span>` elements (inline editor footer and expanded dialog footer). Keep `plainDesc` and the SAP `TEXT` payload logic unchanged.
  - `src/components/report/RecordEditDialog.tsx`: remove the `descChars` variable and the character-count/read-only summary block above the **Open** button; keep the editor and SAP save flow unchanged.
- The database column `nfa.detailed_description` is already PostgreSQL `text`, so no schema change is needed for unlimited input.
- No explicit length validation currently exists in the form submit handlers; this plan only removes the displayed counters.
