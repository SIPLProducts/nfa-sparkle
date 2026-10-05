# Organize all User Management details

## Confirmed current behavior

- The Users table currently has only **User**, **Roles**, **Status**, **Created**, and **Actions** headings.
- Name, User ID, email, employee/company value, department, and contact are combined inside the single **User** cell, so several values do not align with a dedicated heading.
- Company code and department are already returned with each user, but company code is not displayed in the table.

## Plan

1. Replace the combined **User** presentation with clearly labeled columns for the existing saved details: **Name**, **User ID**, **Email**, **Company**, **Department**, **Contact**, **Roles**, **Status**, **Created**, and **Actions**.
2. Keep each row aligned to those headings and display a clear dash for an empty value so columns never shift or appear to contain another field’s data.
3. Give the table a stable minimum width and preserve horizontal scrolling on narrower screens, ensuring all details and every existing action remain accessible without wrapping values into the wrong column.
4. Preserve search, Create User, Edit, Password, Activate/Deactivate, Delete, roles, dialogs, server calls, and all stored data exactly as they work now.
5. Verify the table with representative complete and incomplete users at desktop and the supplied viewport, then confirm all action buttons still target the correct row and the build remains clean.

## Scope

This is a User Management table presentation change only. No database, API, authentication, permissions, role, or user-data changes.
