# CI/CD

No GitHub Actions, GitLab CI, CircleCI, or other workflow directory/file was found. `vercel.json` specifies `npm run vercel-build`, output `dist/client`, and an SSR function, but it is deployment configuration rather than a complete pipeline. Branch protections, deployment secrets, release automation, artifacts and approval gates **Need confirmation**.

A minimum future pipeline should run `npm ci`, `npm run lint`, `npm test`, `npm run build`, migration validation, then a deployment-specific smoke test. Never print environment values in CI logs.
