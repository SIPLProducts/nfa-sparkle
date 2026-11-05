Remove "check": "X" from the Plant request

The Plant list request sent to SAP will contain only the selected company code:

```text
{ "cc_code": { "CC_CODE": "1000" } }
```

Changes
- Plant request builder: stop adding `check`, and strip any `check` left in the saved settings body, so SAP receives only `CC_CODE`.
- Update the existing Plant test to expect the body without `check`.
- Saved Plant F4 body template: change it to `{ "cc_code": { "CC_CODE": "1000" } }` so the settings screen matches (Production needs the same edit in SAP API Settings).

Nothing else changes: Plant dropdown, response reading, other fields and APIs stay as they are.
