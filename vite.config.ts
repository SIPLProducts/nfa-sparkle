// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Inside the Lovable build environment the output layout is pinned by the platform.
// For self-hosted (Ubuntu/nginx) builds we emit the static frontend into `dist/`
// and keep the Node server bundle in `.output/server`.
const isLovableBuild = process.env.LOVABLE_SANDBOX === "1" || !!process.env.SANDBOX;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Self-hosted build: emit a static index.html shell so nginx can serve dist/ directly.
    ...(isLovableBuild
      ? {}
      : { spa: { enabled: true, prerender: { outputPath: "/index.html" } } }),
  },
  // Self-hosted build: skip the Cloudflare/wrangler bundling step.
  ...(isLovableBuild ? {} : { nitro: false as const }),
});

