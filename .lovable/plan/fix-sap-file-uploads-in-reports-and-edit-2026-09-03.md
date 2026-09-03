# Fix SAP file uploads in Reports and Edit

## Confirmed current behavior

- Reports, My NFAs, Attached Docs, and the Edit dialog share `uploadToSap`, which reads each selected file with `FileReader`, removes only the data-URL prefix, and sends the full base64 content as `upload.file[].file` with its original `file_name`.
- The authenticated upload route validates the session, but does not resolve the logged-in user's User ID. `callEnfaUpload` currently fills `upload.user_name` from the SAP endpoint's Basic Auth username. SAP requires the NFA initiator's User ID here, so a technically valid file can be rejected or not attached.
- The stored endpoint method, path, JSON headers, nested `upload` shape, `reffld`, and file array are already settings-driven and correct.
- The upload route now rejects an empty/unrecognized SAP reply instead of returning `{status:null,message:null,enfaNo:null}` as success, and exposes SAP request/response diagnostics in response headers.
- The middleware accepts 50 MB JSON while the UI permits 40 MB of source files. Base64 adds roughly 33%, so a near-limit upload can exceed the middleware limit before reaching SAP.

## Changes

1. **Send the correct dynamic SAP username**
   - In the authenticated upload route, resolve `profiles.username` for the verified session user.
   - Reject the upload with a clear configuration error if that User ID is missing; do not fall back to a hardcoded or endpoint credential value.
   - Pass the resolved User ID into `callEnfaUpload` and place its uppercase value in `upload.user_name` for both the Reports (`report`) and Edit/My NFA (`my`) endpoint paths.
   - Keep the endpoint username/password solely for SAP Basic Authentication.

2. **Validate and preserve actual file data**
   - Keep the existing browser-side base64 conversion and nested payload shape:

```json
{
  "upload": {
    "user_name": "<logged-in User ID>",
    "reffld": "<selected ENFA number>",
    "file": [
      { "file_name": "<original filename>", "file": "<complete base64 content>" }
    ]
  }
}
```

   - Add server-side validation for non-empty filenames and valid, non-empty base64 content before calling SAP, so damaged or truncated file data fails clearly.
   - Preserve multiple-file upload and existing 40 MB UI behavior.

3. **Remove the encoded-size failure boundary**
   - Raise the middleware JSON limit and both deployment examples to 60 MB so a 40 MB source upload plus base64/JSON overhead reaches SAP intact.
   - Leave existing upload timeout and all non-upload API behavior unchanged.

4. **Handle SAP responses accurately**
   - Continue treating only SAP `STATUS = S` or an explicit success message as success.
   - Return SAP `STATUS`, `MESSAGE`, and `ENFA_NO` on success; return SAP's actual message on rejection; treat empty or malformed replies as upload failures.
   - Keep `x-sap-url`, `x-sap-method`, `x-sap-request`, `x-sap-response`, `x-sap-status`, and latency diagnostics so Inspect → Network shows the final SAP call details without exposing credentials.

5. **Verify both flows**
   - Type-check the focused changes.
   - Upload a small known file from Reports and from the Edit dialog, then verify in Inspect → Network that:
     - the browser request contains the selected ENFA number, original filename, and non-empty base64 file data;
     - the final SAP request diagnostic contains the logged-in User ID, correct `reffld`, filename, method, and endpoint;
     - the response contains `STATUS: S`, SAP's success message, and the ENFA number;
     - the attachment list refreshes and the uploaded document is returned by SAP.

## Scope

Only the shared upload route/helper, SAP upload call, middleware body-size configuration, and upload response handling will change. Existing screens, filters, pagination, record editing, endpoint configuration, and other SAP integrations remain unchanged.
