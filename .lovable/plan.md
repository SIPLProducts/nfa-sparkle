# Series inside the Company section (Create User and Edit User)

## What you'll see
- In both Create User and Edit User, **Series** sits directly under **Company** as part of one Company section, with a small "Company" heading over the two fields.
- The Series dropdown lists every Series from User Management > Companies > Range, for example "9000 (9000–9499)". It loads as soon as the dialog opens, and a "Retry" link appears if loading fails.
- Edit User opens with the user's saved series selected. If that series was later removed from Range, it still shows so it isn't lost.
- Choosing "No series" clears the user's series.
- After you save, the Users list shows the new series under the company. Reopening Edit User shows it again.
- Nothing else changes: the Company field, the required checks, what is sent to SAP, and Create NFA.

## Technical details
- Move `SeriesSelect` next to `CompanyNameField` in both dialogs, wrapped in a shared `CompanySection` (a `sm:col-span-2` grid).
- Edit User already sends `SERIES`, and the update handler writes `profiles.company_series`. Check this end to end: create a test user with series 9500, confirm it reads back in the list and in Edit User, change it to 1000, and confirm again.
- After create or update, refresh the users list so the new series shows right away.
