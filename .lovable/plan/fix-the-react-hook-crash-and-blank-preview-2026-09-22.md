# Fix the React hook crash and blank preview

## Confirmed root cause

- The application has one installed copy of React 19.2.5 and one matching React DOM 19.2.5, so this is not a hook-rule error in the page code or duplicate packages on disk.
- The browser stack shows React and React DOM loaded with different Vite dependency-cache hashes.
- The server log confirms that Vite discovered additional TanStack dependencies after the page had started, rebuilt its optimized dependencies, and reloaded. That temporarily leaves two React module generations active, so TanStack Router's `HeadContent` receives a null React hook dispatcher and the preview becomes blank.
- Existing React deduplication protects package resolution, but it cannot merge two optimizer generations already loaded in the browser.

## Implementation

1. **Stabilize dependency optimization before the first page render**
   - Update the existing Vite configuration to pre-bundle the browser dependencies used by React, React DOM, TanStack Router, TanStack Start, and their directly observed runtime helpers.
   - Use one canonical entry per dependency to avoid creating duplicate optimizer aliases.
   - Retain the existing React deduplication and all current Lovable, TanStack, Tailwind, deployment, and server settings.

2. **Refresh only the development dependency cache**
   - Restart the supervised preview once so Vite creates one clean dependency generation from the updated configuration.
   - Do not change application data, authentication, routes, Print Form behavior, SAP integration, middleware, or deployment ports.

3. **Verify the failure is gone**
   - Test a cold preview load and a subsequent source refresh, because this defect occurs during development optimization rather than ordinary type checking.
   - Confirm `/`, `/auth`, and an authenticated application page render without a blank screen.
   - Confirm React and React DOM use the same optimizer hash and the console has no invalid-hook-call, `useContext`, or `HeadContent` errors.
   - Run focused application tests and the full type check to confirm existing functionality remains intact.

## Scope

Only the Vite development dependency-optimization configuration and its generated cache are affected. No page, workflow, document, API, database, or business logic changes are included.
