# Confirm nginx quality config stays as one file with four server blocks

The current `deploy/nginx/nfa-quality.conf` already follows the requested pattern: one self-contained nginx file with all quality-server configuration inside it. The four `server { ... }` blocks are required because nginx binds each block to a distinct public port (8081, 8001, 8082, 3004).

## What I will change

1. Add a short comment at the top of `deploy/nginx/nfa-quality.conf` explaining why four `server` blocks are necessary (one per listen port).
2. Keep the existing upstream blocks, proxy settings, timeouts, body-size limits, and IP allow/deny rules unchanged.
3. No port, path, or application env changes.

## Files to edit

- `deploy/nginx/nfa-quality.conf` (add explanatory comment only)

## Out of scope

- No consolidation into a single `server` block (not supported by nginx for multiple ports).
- No URL-path-based routing or port changes.
- No application source code changes.
