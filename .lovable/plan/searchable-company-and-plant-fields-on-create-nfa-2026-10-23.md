# Searchable Company and Plant fields on Create NFA

## What changes
- Company and Plant become searchable pickers: click the field (search icon shown), type to filter by code or name, pick a value.
- Same display as today (`CODE – Name`), same placeholders ("Loading…", "Select company first", "No plants returned by SAP"), same disabled rules, Retry links and error text.
- Choosing a Company still reloads plants and clears the Plant; the values sent to SAP are unchanged.
- "No matching company/plant" shown when the search finds nothing.

## Technical details
- `src/routes/_authed.nfa.new.tsx` only: replace the two `Select` blocks with a Popover + `Command` (`CommandInput`, `CommandList`, `CommandEmpty`, `CommandItem`) combobox, the pattern already used for Company in User Management.
- `onSelect` calls the existing `setCompany` / `setPlant`; search value includes code and name. No changes to fetches, state, validation or payloads.
