# Testing

Vitest is configured in `vitest.config.ts` for Node, global APIs, and `src/**/*.test.{ts,tsx}`. Run:

```bash
npm test
npm run test:watch
npx vitest run src/backend/api.test.ts
npm run lint
```

`src/backend/api.test.ts` is the only discovered test suite. It uses a `better-sqlite3` test database through `src/backend/test-helper.ts` and covers hashing/tokens, direct SQL repository behavior, validations and response helpers. It does not exercise the deployed HTTP router over a real request stack, Prisma/PostgreSQL migrations, OAuth callback, Socket.IO authorization, report generation, uploads, UI, Flutter, or browser end-to-end workflows. Test output may contain debug `console.log` statements in the existing test source.

For failures, run the single file above, confirm generated Prisma code and database configuration, then inspect SQL schema expectations in `test-helper.ts`. Coverage reporting is not configured (**Needs confirmation**).
