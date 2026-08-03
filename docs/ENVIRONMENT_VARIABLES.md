# Environment variables

Never commit `.env` files. Values below are names found in source/configuration, not secrets.

| Variable | Required | Example | Default | Used by | Description / security notes |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | Yes | `postgresql://user:password@localhost:5432/servio` | legacy code: `file:./prisma/app.db` | Prisma, API, scripts | DB URL. Provider mismatch is documented in [Database](DATABASE.md). Secret. |
| `DIRECT_URL` | Conditional | PostgreSQL direct URL | — | Prisma config/migration scripts | Overrides database URL for direct Prisma connections. Secret. |
| `PRISMA_ACCELERATE_URL` | Optional | `prisma://...` | — | `src/lib/prisma.ts` | Prisma Accelerate connection. Secret. |
| `AUTH_SECRET` | Production yes | secure random value | dev fallback in some paths | sessions/files | Signs cookies and may sign files. Secret. |
| `JWT_SECRET` | Production yes if no `AUTH_SECRET` | secure random value | dev fallback | bearer tokens/sessions | Secret; use separate strong value if configured. |
| `SMTP_HOST`, `SMTP_PORT` | Email yes | `smtp.example.com`, `587` | host varies; port 587/465 | email/OTP | SMTP connection. |
| `SMTP_USER`/`SMTP_EMAIL`, `SMTP_PASS`/`SMTP_PASSWORD` | Email yes | placeholder credentials | — | email/OTP | SMTP aliases are supported. Secrets. |
| `SMTP_FROM` | Optional | `Servio <noreply@example.com>` | SMTP user/email | email | Sender identity. |
| `APP_URL` | OAuth/email yes | `https://app.example.com` | `http://localhost:5173` for email | OAuth/email | Public canonical origin. |
| `APP_ORIGIN`, `PUBLIC_APP_ORIGIN`, `VERCEL_URL` | Optional | `https://app.example.com` | — | notification email | Email link origin fallbacks. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth yes | placeholders | — | Google OAuth | Register callback `/api/auth/google/callback`; secret is confidential. |
| `VITE_GOOGLE_MAPS_API_KEY` | Maps optional | browser-restricted key | code contains unsafe fallback | map UI | Public build-time key; restrict by origin/API. |
| `VITE_GOOGLE_MAPS_JS_ENABLED` | Optional | `true` | false-like | profile UI | Enables Google Maps JS loading. |
| `GEOCODING_API_URL`, `GEOCODING_USER_AGENT` | Optional | provider URL, `Servio/1.0` | Nominatim, `Servio/1.0` | API | Address search provider configuration. |
| `FILE_STORAGE_PATH` | Production yes | `/srv/servio/storage` | `storage` | API/report files | Must be persistent, private, writable. |
| `FILE_SIGNING_SECRET` | Production yes | secure random value | `AUTH_SECRET`, then insecure dev string | file downloads | Separate signing secret recommended. |
| `MAX_UPLOAD_BYTES` | Optional | `10485760` | 10 MiB | uploads | File-size cap. |
| `ALLOWED_UPLOAD_TYPES` | Optional | `image/jpeg,image/png,application/pdf` | JPEG/PNG/WebP/PDF | uploads | Comma-separated MIME allowlist. |
| `PUPPETEER_EXECUTABLE_PATH` | Optional | browser executable path | bundled/serverless selection | report export | System-specific executable. |
| `PLATFORM_COMMISSION_RATE` | Optional | `0.10` | `0.1` | payment logic | Validate business decision before changing. |
| `PORT` | Optional | `3000` | 3000 | Node wrapper | HTTP listen port. |
| `SOCKET_PORT`, `SOCKET_CLIENT_ORIGIN`, `SOCKET_URL`, `VITE_SOCKET_URL` | Realtime conditional | `4001`, app origin, socket URL | 4001, `*`, local URL | Socket server/browser/API | Lock origin in production; browser variable is public. |
| `SERVIO_ORIGIN` | Optional | `http://localhost:5173` | `http://localhost:8080` | CMS sync script | Target app origin. |
| `SQLITE_MIGRATION_SOURCE` | Optional | `prisma/app.db` | that path | migration script | Source legacy file path. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `admin:create` yes | placeholders | — | admin script | Bootstrap credentials; never commit. |
| `NODE_ENV`, `VERCEL`, `TMPDIR` | Platform-managed | `production` | varies | runtime | Change security/storage behavior; do not fake platform state. |
