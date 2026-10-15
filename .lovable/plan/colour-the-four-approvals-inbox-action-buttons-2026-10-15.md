# Colour the four Approvals Inbox action buttons

## What you will see

Each decision button gets its own colour, and that colour stays visible whether or not a record is selected:

- **Approve** — green
- **Cancel / Reject** — red
- **Back To Initiator** — amber
- **Clarification** — blue

Before you pick a record, each button shows a soft tinted version of its own colour (green tint, red tint, amber tint, blue tint) instead of the flat grey every button shares today. Once a record is selected, the button fills solid.

## Why they all look grey in your screenshot

Two separate things are hiding the colours:

1. The button row has one blanket rule that turns every disabled button grey. Nothing was selected in the screenshot, so all four were disabled and identical.
2. Back To Initiator and Clarification already use two shades of the same blue, so even when enabled they are hard to tell apart.

## Changes

1. **Colour tokens** — add four action colours (approve, reject, return, clarify) plus a light tint and a border tone for each, so the palette lives in one place and other screens can reuse it later.
2. **Approvals Inbox toolbar** — point the four buttons at those tokens, and replace the single "grey out every disabled button" rule with per-button disabled styling that keeps each button's own hue.

Enabled state: solid fill, white label, subtle shadow, slightly deeper on hover.
Disabled state: pale tint background, coloured label and border, so the button is still recognisable but clearly inactive.

## What is not touched

- Click behaviour, the "select a record first" check, when each button is enabled, labels (including Cancel vs Reject for initiators), icons, order and sizes.
- Every SAP request and payload.
- Refresh, Preview, Print Form and Attached Docs stay neutral.
- No database, migration or SAP configuration change — this ships with the usual web app build.

## Technical details

**src/styles.css** — new `:root` tokens, each mapped in `@theme inline` so Tailwind generates the utility classes:

```text
--action-approve  green   (white label, AA contrast)
--action-reject   red     (existing destructive hue, kept)
--action-return   amber   (tuned dark enough for a white label)
--action-clarify  blue    (distinct from the amber and green)
```

Each also gets `-soft` (tint) and `-edge` (border) partners, exposed as `bg-action-approve`, `text-action-approve`, `border-action-return`, etc.

**src/routes/_authed.approvals.tsx** — the four `<Button>` elements in the toolbar keep their `onClick`, `disabled` and icon markup; only `className` changes, e.g.:

```text
Approve:            bg-action-approve text-on-action hover:bg-action-approve/90
                    disabled:bg-action-approve-soft disabled:text-action-approve disabled:border-action-approve-edge
Reject/Cancel:      same pattern with --action-reject
Back To Initiator:  same pattern with --action-return
Clarification:      same pattern with --action-clarify
```

The container-level `[&_button:disabled]:bg-muted …` rule is removed so it stops flattening all four to grey.

**Verification** — type-check and build, then a browser run with a selected and an unselected record: confirm four visibly different hues in both states, correct hover/active response, and no console errors. Amber's lightness is checked against the white label for readability; if it falls short, the amber button switches to a cream background with a dark amber label while the other three keep solid fills.
