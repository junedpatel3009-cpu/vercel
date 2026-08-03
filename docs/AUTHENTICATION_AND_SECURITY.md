# Authentication and security

## Implemented controls

- Local login returns a signed session cookie and bearer access token. Cookie signing is in `src/lib/auth-session.server.ts`; bearer token issuing/reading is in `src/backend/auth.server.ts`.
- Passwords are scrypt-hashed in `src/lib/password.server.ts`; legacy hash upgrade support is present.
- Google OAuth creates a state cookie and validates it in callback routes.
- API input is validated with Zod and per-route roles are checked by `currentUser`.
- Uploads have configurable size/MIME checks and signed download URLs; path traversal is checked on deletion.

## Findings

| Severity | Finding | Evidence | Recommended remediation |
| --- | --- | --- | --- |
| High | Socket.IO trusts client-provided user IDs and has no visible handshake/session verification. An attacker able to connect can attempt user rooms, conversation history, message events and call signaling. | `server/socket-server.mjs` handlers consume `userId`, sender/receiver IDs and room names from event payloads. | Authenticate at handshake from a signed token/cookie; derive identity server-side; authorize every room/conversation action. |
| High | A Google Maps API key is hard-coded as a fallback in client source. | `src/client/profile-setup.tsx`, `src/professional/profile-setup.tsx` | Revoke/rotate if real, remove fallback, inject a restricted public key through deployment configuration. |
| Medium | API CORS is `access-control-allow-origin: *`, including credential-adjacent application endpoints. | `src/backend/api.server.ts` | Use an explicit production origin allowlist and review cookie `SameSite` policy. |
| Medium | A dev file-signing fallback (`dev-file-secret`) permits predictable signed URLs if production secrets are absent. | `src/backend/api.server.ts` | Fail startup/requests in production when `FILE_SIGNING_SECRET`/`AUTH_SECRET` is absent. |
| Medium | The repository shows inconsistent SQLite/PostgreSQL persistence and an ephemeral Vercel configuration beside filesystem storage. | `prisma/schema.prisma`, `src/lib/*-db.server.ts`, `vercel.json`, `DEPLOY.md` | Select one persistent production data architecture and test it end-to-end. |
| Low | Production security headers, CSRF middleware, rate limiting, audit logs, malware scanning, and webhook signing were not found. | Server/API configuration | Add a reverse-proxy/app security baseline and documented threat model. |

Do not log tokens, passwords, SMTP credentials, raw authorization headers or signed URLs. `console.info` API access logs include method/path/status/request ID; errors include stack traces server-side.
