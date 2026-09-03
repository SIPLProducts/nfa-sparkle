# Plan: Simplify Create NFA header & remove Approver Chain

## Scope
All changes are confined to `src/routes/_authed.nfa.new.tsx`. No SAP API integration, payload structure, endpoints, or other screens are touched.

## Changes

### 1. Header actions (lines 477–487)
- Remove the **"Submit for Approval"** button entirely.
- Replace the existing **Save** button with a single **Submit** button:
  - Icon: `Send` (submit icon) instead of `Save`.
  - Label: `Submit`.
  - Action: calls `submit(false)` — the same flow previously used by "Submit for Approval", so the NFA is created and submitted in one step.
- Keep the **Load Sample** button and grid/flex layout classes unchanged.

### 2. Remove the Approver Chain section (lines 668–710)
- Delete the entire `Section` titled "Approver Chain" (level cards, add/remove level buttons, helper text) from the right column.
- Keep the **Document Attachments** section in place; the right column layout (`lg:col-span-1`) stays as-is.
- Remove the now-unused helpers and state wiring only where safe: `addLvl`, `removeLvl`, `Users`/`Trash2`/`Plus`/`Label` imports if no longer referenced elsewhere.
- Keep the `approvers` state and the optional `validApprovers` block inside `submit()` untouched — `Load Sample` still populates approvers and they are still resolved/inserted when present, preserving existing submit behavior.

### 3. Submit validation adjustment (line 286)
- Since the chain UI is gone, remove the guard `if (!asDraft && validApprovers.length === 0) return toast.error(...)`. Otherwise Submit would always be blocked with "Add at least one approver".
- The remaining `if (validApprovers.length) { ... }` block already handles the no-approver case gracefully, so the insert flow, audit log, attachments upload, and SAP submit are unchanged.

## What stays exactly the same
- SAP Create payload, `user_name` resolution, endpoints, timeouts, attachment upload flow, audit entries, rich-text editor, and all other form sections.
- All other routes/screens untouched.

## Verification
- Run `tsgo` typecheck.
- Open `/nfa/new` in the preview: confirm only Load Sample + Submit (Send icon) in the header, no Approver Chain card, Document Attachments intact, and submitting a filled form still creates the NFA successfully.
