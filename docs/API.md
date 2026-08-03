# API reference

The implemented HTTP API is `/api/v1`, in `src/backend/api.server.ts`; a separate OAuth pair is in `src/routes/api/auth/`. Successful responses are `{ "data": ... }`; failures are `{ "error": { "message", "details?", "requestId" } }` from `src/backend/http.server.ts`. Every API response receives `x-request-id`. CORS permits all origins and common methods (see Security).

Bearer access tokens or a session cookie satisfy authenticated endpoints. A missing session is 401 and a role mismatch is 403. Invalid JSON is 400; Zod validation commonly returns 422; missing resources return 404. No pagination, generic filtering/sorting, idempotency keys, rate limits, webhook HTTP endpoints, or API-version negotiation beyond the `/v1` path were found.

## Auth and profile

| Method/path | Auth | Body/query and behavior |
| --- | --- | --- |
| `GET /health` | Public | `{ok,database,timestamp}` |
| `POST /auth/register` | Public | `role` CLIENT/PROFESSIONAL, names, email, optional phone, password 8–128; 201 user/token and dev verification token |
| `POST /auth/login` | Public | email/password; sets session cookie and returns user/token/profile-complete |
| `POST /auth/logout` | Public | Clears session cookie |
| `GET /auth/me` | Any | Current public account |
| `POST /auth/verify-email` | Public | `{token}` (20+ chars) |
| `POST /auth/password/forgot` | Public | `{email}`; always accepts; dev may expose token |
| `POST /auth/password/reset` | Public | `{token,password}`; password 8–128 |
| `GET/PATCH /profile` | Any | PATCH permits named profile fields and up to 50 skills |
| `GET /api/auth/google?returnTo=/...` | Public | Redirects to Google; return target must be a safe relative path |
| `GET /api/auth/google/callback` | Public | Google redirect callback with state/code |

Example:

```bash
curl -X POST http://localhost:5173/api/v1/auth/register -H 'content-type: application/json' -d '{"role":"CLIENT","firstName":"Ada","lastName":"Lovelace","email":"ada@example.com","password":"eightchars"}'
```

## Marketplace, client, professional

| Method/path | Auth/role | Purpose |
| --- | --- | --- |
| `GET /jobs`, `/categories`, `/services`, `/professionals` | Public | Marketplace lists |
| `GET/POST /client/jobs` | Client | Owned jobs; POST validates `clientJobSchema` (`src/lib/validation/client-job.ts`) |
| `GET/PATCH/DELETE /client/jobs/:id` | Client/owner | Read, replace validated fields, cancel owned job |
| `GET /client/applications` | Client | Applications for client jobs |
| `POST /client/hire` | Client | Create direct hire contract; shape follows `createHireContract` |
| `POST /client/reviews` | Client | `{trackingId,rating:1..5,comment?}` |
| `POST /professional/applications` | Professional | job ID, nullable positive bid, duration, 20–4000 char letter, up to 10 attachments |
| `POST /professional/services` | Professional | category, 2–160 char name, 20–4000 char description, price/image |
| `GET /professional/jobs/history` | Professional | Applications/history |
| `GET /professional/earnings` | Professional | Transactions and withdrawals |
| `POST /professional/payouts` | Professional | positive amount; BANK/UPI/WALLET destination |

## Supporting APIs

| Method/path | Auth | Purpose |
| --- | --- | --- |
| `GET /notifications`; `POST /notifications/read` | Any | Get/mark notifications read |
| `POST /notifications/browser-subscriptions` | Any | `{endpoint,p256dh,auth}` browser subscription |
| `GET /maps/address-search?q=...` | Any | Query must be 3+ chars; proxies configured geocoder |
| `POST /maps/distance` | Any | `{from:{latitude,longitude},to:{latitude,longitude}}`; returns kilometers |
| `GET /maps/nearby-services?latitude=&longitude=&radiusKm=` | Any | Verified professionals, radius max 500 |
| `POST /files` | Any | Multipart upload; configured type/size checks |
| `GET /files/:id/access`, `GET /files/:id/content?expires=&signature=` | Any/signed | Grant then consume a 5-minute signed URL |
| `DELETE /files/:id` | Owner/admin | Delete file and metadata |
| `GET /wallet`; `POST /payments`; `POST /payments/:id/refund` | Any/client/client | Wallet and internal payment/refund flow |
| `GET /faq`; `POST /contact` | Public | Published FAQ / contact request |

## Administration and reports

All `/admin/*` endpoints require ADMIN: dashboard, users, `PATCH /users/:id/status`, professional verification, jobs and job status, payments, reports, CMS, FAQ creation/listing, and contact requests. Report endpoints are `GET /reports/overview`, `/tables`, `/summary`, `/history`; `POST /reports/preview`, `/download`; `DELETE /reports/history/:id`. Request/response columns are report-type-dependent; inspect the handler at `src/backend/api.server.ts` before adding a client.

## Realtime

`server/socket-server.mjs` exposes Socket.IO events for presence, notifications, project activity, typing, message send/history/clear, and WebRTC offer/answer/ICE/end signaling. It persists conversations/messages in SQLite tables. There is no documented transport-level authentication enforcement in this server.
