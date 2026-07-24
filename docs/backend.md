# Servio backend

The backend is integrated into the TanStack Start server entry. All browser server-functions and REST endpoints use the same SQLite database (`DATABASE_URL`, default `prisma/app.db`). The obsolete standalone Node server and its second database were removed.

## Structure

- `src/server.ts` — process entry, health check, REST dispatch, SSR fallback
- `src/backend/api.server.ts` — versioned REST routes and module orchestration
- `src/backend/auth.server.ts` — JWT issuance/verification and one-time tokens
- `src/backend/database.server.ts` — connection lifecycle and backend schema migrations
- `src/backend/http.server.ts` — API errors and response envelope
- `src/lib/*.server.ts` — domain repositories used by both REST and existing frontend server-functions

## Configuration

Copy `.env.example` to `.env`, replace every secret, and configure SMTP before production. `AUTH_SECRET`, `JWT_SECRET`, and `FILE_SIGNING_SECRET` must be independent high-entropy values. Uploaded files are stored under `FILE_STORAGE_PATH` and are ignored by Git.

Run `npm run dev` for local development. Production uses `npm run build` followed by `npm start` on a persistent Node host. The API health endpoint is `GET /api/v1/health`.

Create or promote the first administrator explicitly with `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create`. No default or hard-coded administrator is created.

## REST modules

All protected routes accept `Authorization: Bearer <JWT>`; existing website sessions are accepted as well.

- Auth: `/api/v1/auth/register`, `/login`, `/me`, `/verify-email`, `/password/forgot`, `/password/reset`
- Profiles: `GET|PATCH /api/v1/profile`
- Client: `/api/v1/client/jobs`, `/client/applications`, `/client/hire`, `/client/reviews`
- Professional: `/api/v1/jobs`, `/professional/applications`, `/professional/jobs/history`, `/professional/earnings`, `/professional/payouts`
- Location: `/api/v1/maps/address-search`, `/maps/distance`, `/maps/nearby-services`
- Storage: `POST /api/v1/files`, `/files/:id/access`, `/files/:id/content`
- Notifications: `/api/v1/notifications`, `/notifications/read`, `/notifications/browser-subscriptions`
- Finance: `/api/v1/wallet`, `/payments`, `/payments/:id/refund`
- Public content: `/api/v1/faq`, `/contact`
- Admin: `/api/v1/admin/dashboard`, `/users`, `/professionals/:id/verification`, `/jobs`, `/payments`, `/reports`, `/faq`, `/contact-requests`

Money is stored as integer minor units. Payment creation is idempotent and updates the professional wallet and ledger in one database transaction. Refunds reverse that ledger transaction. External card/bank capture still requires the deployment's chosen payment provider; provider secrets must never be sent by the frontend.
