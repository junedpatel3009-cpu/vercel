// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  // The application uses better-sqlite3 and local secure file storage, both of
  // which require a persistent Node runtime rather than a Cloudflare Worker.
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    // better-sqlite3 is a native Node module and must be loaded from node_modules
    // at runtime instead of being folded into the SSR/worker JavaScript bundle.
    ssr: {
      external: ["better-sqlite3"],
    },
  },
});
