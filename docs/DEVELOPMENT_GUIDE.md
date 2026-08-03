# Development guide

Use TypeScript/React files for web work and preserve the route split: add page adapters in `src/routes/`, role UI in its matching feature directory, API route branches in `src/backend/api.server.ts`, and database logic in a focused `src/lib/*.server.ts` module. Use Zod validation at HTTP boundaries and enforce ownership/role checks before reads and writes.

Before a change: run `npm run lint` and relevant Vitest tests; after UI/API changes run `npm run build`. Formatting is Prettier (`npm run format` writes files) and ESLint is configured in `eslint.config.js`. The repository does not state branch naming, commit, PR, or code-review policies—**Needs confirmation**.

When adding an API endpoint, document method/path/auth/body/errors in [API](API.md), return the common `{data}` / `{error}` envelope, and add tests. For a Prisma model, update the schema, create/review a migration in the agreed database environment, regenerate client, and update [Database](DATABASE.md). Do not add database writes to SSR components. Update documentation and avoid editing generated `src/routeTree.gen.ts` or `src/generated/prisma/`.
