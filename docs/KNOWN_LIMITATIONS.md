# Known limitations

## Confirmed

- Persistence is split between a PostgreSQL Prisma schema and extensive SQLite legacy repositories; migration completeness is unconfirmed.
- Only one test suite exists and it does not cover browser, Flutter, OAuth, Socket.IO, reports/uploads or production PostgreSQL.
- Socket.IO authorization is not visibly enforced server-side.
- Public CORS and a hard-coded Maps-key fallback are present.
- Filesystem storage and SQLite cannot safely rely on ephemeral serverless filesystems; `DEPLOY.md` confirms this.
- No CI workflow, license, coverage configuration, metrics/tracing/alerting, queue or scheduled-job implementation was found.

## Inferred concerns — validate before planning

- Large admin/report route handlers may be hard to maintain without splitting and contract tests.
- Concurrent multi-instance realtime/database behavior may be inconsistent because the socket server and local files are process-local.
- The Flutter app’s port fallback and its functional parity with the web UI may drift.
