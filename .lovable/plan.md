# One "Company Series" field in Create User and Edit User

## What you'll see
- The boxed Company section is gone and the form goes back to its earlier layout. Where Company used to be, there is now one dropdown labeled **Company Series**.
- It lists the series from User Management > Companies > Range, for example "9000 (9000–9499)".
- **Create User:** Company Series is required, the same way Company was ("Company Series is required").
- **Edit User:** the user's saved series is selected when the dialog opens, and you can change it.
- The Users list shows the saved series in the company column.

## How it's saved
- The chosen series (for example 9500) is saved as both the user's company code and their series. The details sent and the field names stay the same, so Create NFA keeps showing that user the companies in their range (9500 shows 9500–9599).
- For users saved earlier with a single company code (for example 9301), Edit User selects the series whose range contains that code (9000). The stored value only changes when you save.

## Technical details
- In both dialogs, replace the `CompanySection` wrapper (CompanyNameField + SeriesSelect) with a single `SeriesSelect` labeled "Company Series" that sets `companyCode` and `series` together. In Edit, resolve the initial value from `company_series`, or else by range lookup on `company_code`.
- Keep the required check in Create, renamed to "Company Series is required". Remove the "No series" option from the Create list.
- `useCompanyOptions` and `CompanyNameField` stay in the code, unused by these dialogs.
