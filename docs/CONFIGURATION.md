# Configuration

- `package.json`: scripts, Node 24 engine, dependencies.
- `vite.config.ts`: TanStack Start server entry and SSR dependency handling; Cloudflare is explicitly disabled.
- `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `vitest.config.ts`: TypeScript, linting/formatting and Node Vitest configuration.
- `prisma.config.ts`: loads `DIRECT_URL` or `DATABASE_URL`; schema is `prisma/schema.prisma` and migration directory is `prisma/migrations`.
- `vercel.json` / `api/ssr.ts`: Vercel SSR build/rewrite configuration; it conflicts with the persistent-storage guidance in `DEPLOY.md` for a full production deployment.
- `wrangler.jsonc`: Cloudflare metadata, but the Vite config disables Cloudflare. **Needs confirmation** whether it is still supported.

Runtime configuration reads `process.env`; browser configuration only exposes `VITE_*` build-time values. Within Prisma config, `DIRECT_URL` wins over `DATABASE_URL`; in most runtime callers `DATABASE_URL` wins. Do not place secret data in a `VITE_*` variable.
