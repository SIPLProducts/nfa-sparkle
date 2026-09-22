// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Inside the Lovable build environment the output layout is pinned by the platform.
// For self-hosted (Ubuntu/nginx) builds we emit one self-contained `dist/`
// release folder: static frontend at the root, Node server in `dist/server`.
const isLovableBuild = process.env.LOVABLE_SANDBOX === "1" || !!process.env.SANDBOX;

export default defineConfig({
  vite: {
    // React hooks must be shared by the renderer and every TanStack package.
    resolve: {
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    // Pre-bundle the complete client runtime before serving the first page.
    // If Vite discovers these TanStack helpers later, it creates a second
    // optimizer generation and React hooks can briefly bind to two dispatchers.
    optimizeDeps: {
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/client",
        "@tanstack/react-query",
        "@tanstack/react-router",
        "@tanstack/react-store",
        "@tanstack/history",
        "@tanstack/router-core",
        "@tanstack/router-core/ssr/client",
        "@tanstack/router-core/ssr/server",
        "h3-v2",
        "seroval",
      ],
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Self-hosted build: emit a standalone Node server for server functions and API routes.
  // Lovable builds keep the platform-managed deployment preset.
  ...(isLovableBuild ? {} : { nitro: { preset: "node-server" } }),
});

