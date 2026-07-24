# Production deployment

Servio targets a persistent Node.js runtime because it uses SQLite (`better-sqlite3`) and filesystem-backed private uploads. Cloudflare Worker bundling is disabled in `vite.config.ts`.

1. Provision persistent storage for `prisma/app.db` and `FILE_STORAGE_PATH`, or migrate those adapters to managed SQL/object storage before using an ephemeral host.
2. Configure all values in `.env.example`, using independent high-entropy auth/JWT/file secrets and real SMTP credentials.
3. Run `npm ci`, `npm run build`, then `npm start`. Set `PORT` when the platform assigns one.
4. Put the process behind TLS and a reverse proxy/load balancer. Back up both the database and storage directory together.

The liveness endpoint is `GET /api/v1/health`. Do not use the old static `vercel.json` rewrite for this full-stack application; a Vercel deployment requires managed database/object-storage adapters because function filesystems are ephemeral.
