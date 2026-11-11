# Reorder Company sub-tabs

In User Management > Company, show the Range (Series) sub-tab first and the Companies sub-tab second. The Company tab opens on Range (Series) by default.

- Tab labels, contents, data and all behaviour stay as they are.

## Technical details
- `src/routes/_authed.admin.users.tsx`: in the nested `Tabs`, put the `range` trigger before `list`, and change `defaultValue` from `"list"` to `"range"`.
