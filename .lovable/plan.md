# Approver mode radio buttons on Create NFA

## What you will see

In the "Organisation & Type" section, directly under the **Company | Plant** row (and above NFA Type | Function), a new row shows two radio buttons:

- **Predefined Approvers** — selected by default
- **Dynamic Approvers**

They sit as a clean, pill-like selection row spanning the full form width, with the same label style as the other fields. On narrow screens the two options stay side by side while they fit, then stack vertically.

```text
Before:                    After:
┌─────────┬──────────┐     ┌─────────┬──────────┐
│ Company │ Plant    │     │ Company │ Plant    │
├─────────┼──────────┤     ├─────────┴──────────┤
│ NFA Type│ Function │     │ ◉ Predefined  ○ Dynamic │
└─────────┴──────────┘     ├─────────┬──────────┤
                           │ NFA Type│ Function │
                           └─────────┴──────────┘
```

## Behaviour

- The choice is stored in page-local state (`approverMode`, values `predefined` / `dynamic`, default `predefined`).
- Selecting either option changes nothing else: the existing Approvers section, SAP calls, payloads, validation and every other screen behave exactly as today. The selection is UI state only — no new API, database or routing change.
- The choice is not included in the Submit payload, so the SAP contract stays identical.

## Changes

One file: `src/routes/_authed.nfa.new.tsx`

- Add a `useState` for the mode and a labelled two-option row between the Plant field and the NFA Type field (full width, `md:col-span-2`).
- Use the existing shadcn `RadioGroup` / `RadioGroupItem` components (`src/components/ui/radio-group.tsx`) styled with the project's design tokens — no hardcoded colours.

## Out of scope

- No changes to the Approvers selector, Submit, SAP payloads, validation, or any other screen.

## Verification

- Type-check and build pass with no new errors.
- Browser check: the radios render below Plant, default to Predefined, switch on click, work at desktop and narrow widths, and everything else on the page is unchanged.
