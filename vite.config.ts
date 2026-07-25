import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    ssr: {
      external: ["better-sqlite3", "sanitize-html"],
      noExternal: [
        "htmlparser2",
        "domhandler",
        "domutils",
        "dom-serializer",
        "domelementtype",
        "entities",
        "deepmerge",
        "escape-string-regexp",
        "is-plain-object",
        "parse-srcset",
        "postcss",
        "launder",
        "dayjs",
        "nanoid",
        "picocolors",
        "source-map-js",
      ],
    },
  },
});
