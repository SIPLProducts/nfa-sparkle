# Rename Save Draft to Save on Create NFA

## Goal
On the Create NFA screen, change the secondary action button label from **Save Draft** to **Save** and update its icon to match, without changing any existing behavior.

## Current state
- File: `src/routes/_authed.nfa.new.tsx`
- The button is rendered inside `PageHeader` actions at line 460–462.
- Current markup:
  ```tsx
  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => submit(true)} disabled={busy}>
    <Save className="h-4 w-4" /> <span className="hidden sm:inline">Save </span>Draft
  </Button>
  ```
- The `Save` icon is already imported from `lucide-react`.

## Change
1. Update the button text to read **Save**.
2. Keep the `Save` icon (it is the natural match for the Save label).
3. Preserve `variant="outline"`, size, `onClick={() => submit(true)}`, and the `disabled={busy}` behavior.

## Out of scope
- No changes to the `submit(true)` logic, local/SAP save flow, or toast messages.
- No changes to other buttons or the page layout.

## Verification
- Build passes.
- Create NFA screen shows a single **Save** button with a Save icon.
- Clicking Save still performs the existing draft save path.
