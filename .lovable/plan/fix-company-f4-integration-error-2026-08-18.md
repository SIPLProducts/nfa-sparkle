# Fix Company F4 integration error

## Confirmed root cause

The Company F4 resolver currently searches for either an endpoint name containing `company` **or** a request body containing `cc_code`, then takes the oldest match. Both active API Settings records match because the Create ENFA payload also contains `CC_code`. The database ordering places **Create ENFA** first, so the Company lookup can call the wrong endpoint configuration and method instead of the configured **Company F4 GET** endpoint.

The SAP API route also passes an upstream HTML `502 Bad Gateway` page directly to the browser. This exposes unreadable HTML in the form and triggers the preview error overlay instead of a controlled SAP connection message.

## Changes

1. **Select only the Company F4 configuration**
   - Update the SAP Company resolver to prioritize the active endpoint explicitly named `Company F4` (case-insensitive).
   - Keep a narrowly scoped compatibility fallback for other company-specific endpoint names, but never select Create ENFA based only on the shared `cc_code` field.
   - Preserve the saved HTTP method, URL/path, query, headers, body, credentials, and middleware routing without hardcoding SAP values.

2. **Keep GET-with-body transport intact**
   - Continue forwarding the configured `{ "cc_code": "" }` body with the GET request through middleware version 1.1.0.
   - Do not change Create ENFA, Reports, or other SAP endpoint execution paths.

3. **Return controlled errors to the form**
   - Convert middleware/tunnel HTML failures into a concise JSON error response rather than passing the full HTML page to the UI.
   - Keep the Company dropdown empty on failure, retain Retry, and display a readable connection/configuration message without triggering the application error overlay.

4. **Validate end to end**
   - Confirm the resolver chooses the `Company F4` database row and sends GET with the configured JSON body.
   - Verify SAP `BUKRS`/`BUTXT` records map to dropdown options dynamically, with no hardcoded company fallback.
   - Recheck Create ENFA submission and existing SAP API Settings behavior for regressions.

## Technical scope

Expected changes are limited to the Company F4 resolver, its public API route/error normalization, and focused regression coverage. No database schema or visual redesign is required.