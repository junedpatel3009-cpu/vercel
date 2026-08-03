# Deployment

The repository's supported production guidance is a **persistent Node.js runtime** (`DEPLOY.md`): run `npm ci`, `npm run build`, then `npm start`, set `PORT`, terminate TLS at a reverse proxy/load balancer, and back up the database and storage together. Run `npm run prisma:deploy` only after validating the chosen PostgreSQL/legacy data strategy.

Required production configuration includes a persistent database URL, high-entropy `AUTH_SECRET`/`JWT_SECRET`/`FILE_SIGNING_SECRET`, SMTP settings, `APP_URL`, persistent `FILE_STORAGE_PATH`, and appropriate OAuth/Maps/realtime settings. Start `npm run socket` as a separate long-lived service when messaging/calls are enabled, configure a non-wildcard `SOCKET_CLIENT_ORIGIN`, and expose its secure Socket.IO URL to clients.

`vercel.json` builds an SSR function, but Vercel function filesystems are ephemeral and `DEPLOY.md` explicitly says the static rewrite should not be used for this storage-dependent application without managed database/object-storage adapters. Cloudflare configuration exists but is disabled in `vite.config.ts`; both serverless paths **Need confirmation**.

Deployment verification: request `/api/health` and `/api/v1/health`, test login, an authorized write, storage read, report generation, SMTP/OAuth callback and realtime connection. Rollback process, domain/HTTPS automation, autoscaling and managed backup retention are not in repository and **Need confirmation**.
