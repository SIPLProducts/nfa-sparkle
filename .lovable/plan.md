# Add search to the Company Name dropdown in User Management

## What changes

Turn the **Company Name** field in User Management (Create user and Edit user dialogs) into a searchable dropdown so users can quickly find a company from the SAP F4 results instead of scrolling a long list.

- Replace the current `Select` inside `CompanyNameField` with a `Popover` + `Command` combobox pattern using the existing `src/components/ui/command.tsx` primitives.
- Add a search input at the top of the dropdown that filters companies by code or name (case-insensitive).
- Keep the existing display format: `{code} – {name}`.
- Preserve current loading, error, and Retry behavior.
- Preserve the existing `companyCode` / `employeeId` mapping: selecting a company stores the code in `COMPANY_CODE` and the name in `EMP_ID`, exactly as today.
- Apply to both Create user and Edit user dialogs automatically because they share `CompanyNameField`.

## Technical details

- File: `src/routes/_authed.admin.users.tsx`
- Component: `CompanyNameField`
- Imports to add: `Popover`, `PopoverContent`, `PopoverTrigger` from `@/components/ui/popover`; `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem` from `@/components/ui/command`; `Check`, `ChevronsUpDown` or equivalent icon from `lucide-react`.
- Behavior:
  - Trigger shows the selected company label or "Select a company" / "Loading companies…" placeholder.
  - Dropdown opens via the trigger.
  - `CommandInput` lets the user type; `Command`’s built-in filtering matches against the rendered `{code} – {name}` text.
  - `CommandEmpty` shows "No company found." when filtering yields no match.
  - `CommandItem` for each company calls `onChange(code, name)` on selection and closes the popover.
  - Loading state disables the trigger and shows the loading placeholder.
  - Error state continues to render below the field with the Retry link.
- No changes to `useCompanyOptions`, server functions, migrations, payloads, or other User Management behavior.
