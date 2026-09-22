# Fix React awaited-render crash

## Goal
Remove the blank-screen `React.use` runtime crash without changing portal behavior.

## Changes
- Align React, React DOM, TanStack Start, Router, and Router plugin versions so the browser uses one compatible runtime.
- Add explicit Vite dependency deduplication only if the aligned package graph still permits duplicate React imports.
- Keep all routes, data loading, authentication, and portal features unchanged.

## Verification
- Confirm only one React and React DOM installation resolves.
- Open public and authenticated navigation paths and check for page errors or blank screens.
- Run the focused type and runtime checks for the application shell.
