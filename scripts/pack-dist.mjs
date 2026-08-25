// Post-build step for self-hosted (Ubuntu/nginx) deployments.
//
// Vite/TanStack Start writes:
//   dist/client/**  -> static frontend (index.html, hashed assets, public/ files)
//   dist/server/**  -> Node server bundle (server functions, /api routes, SSR)
//
// For deployment we want a flat `dist/` holding only the static frontend, and
// the server bundle kept aside in `.output/server`. Inside the Lovable build
// environment the platform owns the layout, so this script does nothing there.

import { existsSync, rmSync, mkdirSync, renameSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const dist = join(root, "dist");
const client = join(dist, "client");
const server = join(dist, "server");

if (process.env.LOVABLE_SANDBOX === "1" || process.env.SANDBOX) {
  console.log("[pack-dist] Lovable build environment detected — leaving output layout untouched.");
  process.exit(0);
}

if (!existsSync(client)) {
  console.log("[pack-dist] dist/client not found — nothing to flatten.");
  process.exit(0);
}

// 1. Move the server bundle out of dist/ into .output/server
if (existsSync(server)) {
  const output = join(root, ".output");
  const outputServer = join(output, "server");
  rmSync(outputServer, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  renameSync(server, outputServer);
  console.log("[pack-dist] Server bundle -> .output/server");
}

// 2. Move everything from dist/client up into dist/
for (const entry of readdirSync(client)) {
  const target = join(dist, entry);
  rmSync(target, { recursive: true, force: true });
  renameSync(join(client, entry), target);
}
rmSync(client, { recursive: true, force: true });

// 3. Drop any leftover build metadata that should not be served publicly
for (const junk of ["nitro.json", "package.json", "package-lock.json"]) {
  rmSync(join(dist, junk), { force: true });
}

console.log("[pack-dist] Static frontend ready in dist/ :");
for (const entry of readdirSync(dist).sort()) console.log("  -", entry);
