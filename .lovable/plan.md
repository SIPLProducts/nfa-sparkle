# Restore login page styling

## Confirmed issue

- The screenshot is the existing login page rendered without the application’s global styles: layout utilities, colors, spacing, typography, card styling, and image sizing are all absent.
- The login page source and its intended design are still intact.
- The global stylesheet currently loads and applies in the local preview, and there are no current build or runtime errors. This indicates a stylesheet delivery/loading failure in the affected Lovable preview rather than a login or authorization failure.

## Plan

1. Reproduce the affected preview state and inspect the login page’s stylesheet request and generated page links.
2. Make the root stylesheet registration reliable for both Lovable preview and the self-hosted build, changing only the shared style-loading entry if required.
3. Preserve the existing login design, logo, fields, demo login, authentication flow, redirects, and all authenticated screens without modification.
4. Verify `/auth` at the current 989×595 viewport and desktop size, including a fresh reload, and confirm the stylesheet returns successfully and remains applied.
5. Confirm the application builds cleanly and that no new browser or runtime errors are introduced.

## Scope

No database, roles, permissions, API, SAP, workflow, or deployment-port changes.
