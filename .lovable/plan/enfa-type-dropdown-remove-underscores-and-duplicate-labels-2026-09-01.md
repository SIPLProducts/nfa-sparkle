# eNFA Type dropdown: remove underscores and duplicate labels

Update every eNFA Type dropdown so the user sees a clean, single label (e.g. "BUDGET DEVIATION" instead of "BUDGET_DEVIATION – BUDGET DEVIATION"), while the underlying `code` value sent to SAP stays unchanged.

## What changes

1. **Shared display helper** — add `nfaTypeDisplayLabel(option)` in `src/lib/sap/master.ts` that returns `option.name.replace(/_/g, " ")`.
2. **Report screen** (`src/routes/_authed.report.tsx`):
   - Extend the local `SingleSelect` helper with an optional `renderLabel` prop.
   - Use it for the **ENFA Type** field so each option renders only the formatted name, not `code – name`.
3. **Create NFA screen** (`src/routes/_authed.nfa.new.tsx`):
   - Render the NFA Type `SelectItem` children with `nfaTypeDisplayLabel(t)` instead of `t.name`.
4. **Change Request screen** (`src/routes/_authed.nfa.$id.change.tsx`):
   - Render the NFA Type `SelectItem` children with `nfaTypeDisplayLabel(t)` instead of `t.name`.

## What does not change

- The `code` / `value` used in state, payloads, and API calls remains exactly as SAP provides it (with underscores when present).
- Static `NFA_TYPES`, `FUNCTIONS`, and other master lists are untouched.
- No changes to report payload, Create payload, approval logic, or database schema.

## Verification

- Open the E-NFA Report filter dropdown: labels show no underscores and no repeated text.
- Open Create NFA → NFA Type dropdown: labels show no underscores.
- Open a Change Request → NFA Type dropdown: labels show no underscores.
- Execute a report or create an NFA: the network payload still contains the original underscored code.
