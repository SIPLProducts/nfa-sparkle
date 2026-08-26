// Post-build step for self-hosted (Ubuntu/nginx) deployments.
//
// Nitro's node-server preset writes the runnable server to
// .output/server/index.mjs and its public browser assets to .output/public.
// Older TanStack builds may instead leave browser assets under dist/client.
//
// For deployment we assemble ONE self-contained release folder: `dist/` holds
// the static frontend at its root and the runnable Node server in
// `dist/server/index.mjs`. `.output/` is then only build scratch. Inside the
// Lovable build environment the platform owns the layout, so this does nothing.

import { existsSync, rmSync, mkdirSync, renameSync, readdirSync, cpSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const dist = join(root, "dist");
const client = join(dist, "client");
const server = join(dist, "server");
const nitroPublic = join(root, ".output", "public");

if (process.env.LOVABLE_SANDBOX === "1" || process.env.SANDBOX) {
  console.log("[pack-dist] Lovable build environment detected — leaving output layout untouched.");
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

// 2. Keep a deployable static-assets directory for nginx. The application HTML
// itself is rendered by the Node server; an SSR build intentionally has no
// dist/index.html.
mkdirSync(dist, { recursive: true });
if (existsSync(nitroPublic)) {
  cpSync(nitroPublic, dist, { recursive: true, force: true });
} else if (existsSync(client)) {
  for (const entry of readdirSync(client)) {
    const target = join(dist, entry);
    rmSync(target, { recursive: true, force: true });
    renameSync(join(client, entry), target);
  }
  rmSync(client, { recursive: true, force: true });
}

// 3. Ship the Node server bundle inside dist/ so the release is one folder.
const nitroServer = join(root, ".output", "server");
const distServer = join(dist, "server");
if (existsSync(nitroServer)) {
  rmSync(distServer, { recursive: true, force: true });
  cpSync(nitroServer, distServer, { recursive: true });
  console.log("[pack-dist] Node server bundle -> dist/server (PM2 entry: dist/server/index.mjs)");
}

// 4. Drop any leftover build metadata that should not be served publicly
for (const junk of ["nitro.json", "package.json", "package-lock.json"]) {
  rmSync(join(dist, junk), { force: true });
}

console.log("[pack-dist] Release folder ready in dist/ (static assets + dist/server/index.mjs):");
for (const entry of readdirSync(dist).sort()) console.log("  -", entry);
