import path from "path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: [
        { find: /^parse5$/, replacement: path.resolve(__dirname, "src/parse5-shim.ts") },
        { find: "@asamuzakjp/css-color", replacement: path.resolve(__dirname, "src/css-color-shim.ts") },
        { find: "css-tree", replacement: path.resolve(__dirname, "src/css-tree-shim.ts") },
      ],
    },
    ssr: {
      external: ["better-sqlite3"],
      noExternal: [
        "isomorphic-dompurify",
        "jsdom",
        "html-encoding-sniffer",
        "@exodus/bytes",
        "@asamuzakjp/css-color",
        "/^@asamuzakjp\\/.*/",
      ],
    },
  },
});