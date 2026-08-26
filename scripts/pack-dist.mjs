// Post-build step for self-hosted (Ubuntu/nginx) deployments.
//
// Vite/TanStack Start writes the browser frontend under dist/client. Nitro's
// node-server preset writes the runnable server to .output/server/index.mjs.
// Older builds may still leave a dist/server directory, which is moved only
// when Nitro has not already produced .output/server.
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

// 1. Preserve Nitro's Node output. Move a legacy dist/server bundle only when
// there is no existing .output/server; otherwise discard only the duplicate.
if (existsSync(server)) {
  const output = join(root, ".output");
  const outputServer = join(output, "server");
  if (!existsSync(outputServer)) {
    mkdirSync(output, { recursive: true });
    renameSync(server, outputServer);
    console.log("[pack-dist] Legacy server bundle -> .output/server");
  } else {
    rmSync(server, { recursive: true, force: true });
    console.log("[pack-dist] Keeping Nitro server bundle in .output/server");
  }
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
