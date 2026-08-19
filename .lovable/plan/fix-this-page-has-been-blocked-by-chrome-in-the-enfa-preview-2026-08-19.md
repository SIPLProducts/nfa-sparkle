# Fix: "This page has been blocked by Chrome" in the eNFA Preview

## Root cause

The SAP call is fine — the document comes back and is turned into a `blob:` URL, then shown with an `<iframe>`. Chrome's built-in PDF plugin refuses to run inside a sandboxed/embedded frame (the Lovable preview, and any iframe-embedded deployment), so instead of the PDF it renders its own "This page has been blocked by Chrome" placeholder. Nothing is wrong with the endpoint, the base64 or the auth — it's purely the way the PDF is displayed.

## Fix

Stop relying on Chrome's PDF plugin and render the pages ourselves.

- Add `pdfjs-dist` and render the returned document into `<canvas>` elements inside the dialog (all pages, scrollable, scaled to the dialog width). This works in every browser and inside iframes.
- Keep a **Open in new tab** action next to Download for users who want the native viewer (a top-level tab is not sandboxed, so the plugin works there).
- **Print** switches to opening the blob in a new window and calling print on it, since there is no iframe document to print anymore.
- **Download** stays exactly as it is.
- If pdf.js fails to parse the document (SAP returned something that isn't a PDF), show the existing error line and fall back to the current local summary view — unchanged behaviour.

## Technical notes

- Only `src/components/report/RecordPreviewDialog.tsx` changes, plus the `pdfjs-dist` dependency.
- Worker is loaded via the bundled `pdfjs-dist/build/pdf.worker.min.mjs` URL (Vite `?url` import) so no CDN dependency.
- The decoded bytes are already available; they are passed straight to `getDocument({ data })`, so the blob URL is only needed for Download / new tab.
- No changes to `src/lib/sap-report.server.ts`, `src/routes/api/public/enfa-print.ts`, API Settings, filters or the report table.
