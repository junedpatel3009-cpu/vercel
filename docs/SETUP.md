# Local setup

## Prerequisites

- Node.js 24.x (declared in `package.json`) and npm.
- For PostgreSQL/Prisma work: PostgreSQL accessible through `DATABASE_URL`; Prisma CLI is installed locally.
- For the companion app: Flutter SDK compatible with Dart `>=3.0.0 <4.0.0` (`flutter_app/pubspec.yaml`).

## Web application

```powershell
git clone <repository-url>
cd skill-shine-gateway-main-main-main
npm ci
Copy-Item .env.example .env
npm run prisma:generate
npm run dev
```

Run `npm run socket` separately for messaging/realtime. Verify `GET http://localhost:5173/api/health` (or use `npm run backend:health` after starting Vite).

### Database decision — required before meaningful development

`prisma/schema.prisma` declares `postgresql`; `.env.example` still illustrates a SQLite URL; much live API behavior uses `better-sqlite3` legacy repositories. Choose and validate one route with the team before writing data:

1. **Legacy local development:** use a writable SQLite `DATABASE_URL` for the legacy store; Prisma generation works, but the Prisma schema/migration path is not a confirmed SQLite setup.
2. **PostgreSQL deployment:** set PostgreSQL `DATABASE_URL` (and optionally `DIRECT_URL`); run `npm run prisma:deploy`, then validate every legacy API feature. The source itself contains migrations/import fallback paths, not a completed unified migration.

Do not run `npm run prisma:migrate` against a shared database: it creates development migrations. `prisma:push` changes schema without migration history.

### Flutter client

```powershell
cd flutter_app
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5173
```

For Flutter web/desktop, use an accessible host such as `http://localhost:5173`; Android emulator uses `10.0.2.2`. See `flutter_app/lib/core/api/api_client.dart`.

## Common setup failures

- `AUTH_SECRET is required`: set `AUTH_SECRET` for production/session paths.
- Prisma connection error: reconcile the database URL/provider mismatch above.
- Vite port vs Flutter fallback: Flutter defaults to port `8080` but Vite normally serves `5173`; explicitly set `API_BASE_URL`.
- Realtime unavailable: start `npm run socket`, set origin/URL variables, and allow port 4001.
