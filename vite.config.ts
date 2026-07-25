import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    ssr: {
      external: ["better-sqlite3"],
      noExternal: [
        "isomorphic-dompurify",
        "jsdom",
        "html-encoding-sniffer",
        "@exodus/bytes",
      ],
    },
  },
});