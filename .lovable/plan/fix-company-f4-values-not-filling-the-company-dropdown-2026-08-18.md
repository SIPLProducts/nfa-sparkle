# Fix: Company F4 values not filling the Company dropdown

## What is happening

The Company F4 endpoint is registered with **HTTP method GET** and a request body of `{ "cc_code": "" }`.
A GET request cannot carry a body, so the current code drops the body entirely — SAP receives an empty
GET on `/e-nfa/enfa_report/create?sap-client=300` and returns nothing usable. The screen then falls back
to the built-in Ramky list and shows "Could not load the company list from SAP".

## The fix

1. **Send the configured body even when the method is GET.** When the saved endpoint has a non-empty
   request body but a body-less method (GET/HEAD), the call is sent as POST with that JSON body, which is
   what the SAP service actually expects. Nothing in API Settings has to be re-typed — the screen keeps
   showing GET if that is what you saved.
2. **Make the response parsing tolerant of SAP's exact shape** — a bare array of `{BUKRS, BUTXT}`, a
   wrapper object such as `{ "company": [...] }` or `{ "f4": [...] }`, and a single object are all accepted
   (case-insensitive keys).
3. **Show the real reason on failure.** Instead of the generic "could not load" note, the Company field
   will show SAP's own status/message so the endpoint can be corrected in API Settings, and a small
   "Retry" link re-runs the lookup.
4. Fallback to the built-in list stays in place, so the screen is never blocked.

## Technical notes

- `callSapCompanyF4()` in `src/lib/sap-report.server.ts`: if `http_method` is GET/HEAD and
  `request_body` is non-empty, issue the call with method POST and that body; otherwise keep the saved
  method exactly as configured.
- `parseCompanyF4()` in `src/lib/sap/master.ts`: accept nested wrappers (search one level deep for the
  first array), single objects, and `BUKRS`/`CC_CODE` + `BUTXT`/`BUTXT`/`NAME1` keys.
- `src/routes/_authed.nfa.new.tsx`: keep the SAP error text returned by `/api/public/sap-company` in
  state and render it under the Company select, plus a Retry action.
- No schema changes; the endpoint row, other endpoints, and every other screen are untouched.
