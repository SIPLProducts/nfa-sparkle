# Searchable Plant From / To on the Reports screen

## What changes
- The Plant "From" and "To" dropdowns become searchable lists. Click one, type a plant code or name (for example "1000" or "Head Office"), and the list narrows as you type.
- Each option still shows "code – name". "Any" stays at the top to clear the choice.
- If nothing matches, the list shows "No plant found".

## What stays the same
- Plants still come from the same SAP plant list ("F4 In Reports Plant Field"), with no change to the request or response handling.
- Selected values, the filters and the report search work as before. Other range fields are untouched.

## Technical details
- In `src/routes/_authed.report.tsx`, add a `PlantCombobox` (shadcn `Popover` + `Command` with `CommandInput`, matching on code and name). Use it in `RangeSelect` in place of the two `Select`s, keeping the same `from/to/onFrom/onTo` props and the `""` = Any convention.
- `RangeSelect` is only used for Plant, so nothing else is affected.
