# Make the app upload match the working Postman call

## What the comparison shows

Postman (working, `200 OK`, 226 B reply):

```text
POST http://10.200.1.2:8000/e-nfa/enfa_report/create?sap-client=300
{ "upload": { "user_name": "SIPL_QM", "reffld": "100117",
              "file": [ { "file_name": "Ramky Estates logo.png", "file": "<base64>" } ] } }
```

The app (failing, empty SAP reply → "SAP accepted the request but returned no response"):

- Both registered upload rows — **Upload Document** and **Attached Docs In MY NFA** — are stored with
  HTTP method **PUT**, same URL, same body template.
- The payload shape, nested `upload` object, `reffld`, original file name and full base64 already match
  Postman; the browser Network payload in the screenshot confirms this.

So the only difference between the working Postman call and the app call is the HTTP method: **PUT vs POST**.
SAP's handler answers on POST and returns an empty body on PUT, which is exactly the observed symptom.

## Changes

1. **Switch both upload endpoints to POST** (data migration on `sap_endpoint`, so it stays settings-driven
   and visible/editable in Admin → SAP API Settings):
   - `Upload Document` → `http_method = 'POST'`
   - `Attached Docs In MY NFA` → `http_method = 'POST'`
   No other endpoint row is touched.

2. **Default the code path to POST too** — in `callEnfaUpload` (`src/lib/sap-report.server.ts`) the
   fallback `(ep.http_method ?? "PUT")` becomes `"POST"`, so a row without an explicit method still
   matches Postman. The configured value always wins.

3. **Username stays dynamic** — no change needed in behaviour, only confirmation: the upload route
   resolves the logged-in user's `profiles.username` from the verified session and sends it uppercase as
   `upload.user_name`. If a user has no User ID on their profile the upload is refused with a clear
   message instead of falling back to the endpoint credential.

4. **Headers and format unchanged** — `Content-Type: application/json`, `Accept: application/json`,
   Basic Auth from the endpoint's system credentials, `?sap-client=300` from the stored path, JSON string
   body exactly as built today.

## Verification

- Upload one small file from **Reports** and one from **My NFAs / Edit**.
- In Inspect → Network on `enfa-upload` check the response headers:
  - `x-sap-method: POST`
  - `x-sap-url` ending in `/e-nfa/enfa_report/create?sap-client=300`
  - `x-sap-request` showing the logged-in User ID, the selected `reffld`, and the original file name
  - `x-sap-response` carrying SAP's real reply (`STATUS: S`, "File upload successful with ENFA No …")
- Confirm the toast shows SAP's success message and the document appears in **Attached Docs**.

## Scope

Only the two upload endpoint method values and the upload helper's method default change. Payload shape,
UI, other endpoints, filters, pagination and every other SAP integration remain as they are.
