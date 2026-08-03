# Troubleshooting

| Symptom | Diagnose | Resolution |
| --- | --- | --- |
| `npm run build` fails at Prisma | Check `DATABASE_URL`, `DIRECT_URL`, provider and generated client | Resolve the SQLite/PostgreSQL design first; run `npm run prisma:generate`. |
| Flutter cannot reach backend | Compare `API_BASE_URL` with actual Vite port | Pass `--dart-define=API_BASE_URL=http://10.0.2.2:5173` on Android emulator, or correct host/port elsewhere. |
| Login/session fails in production | Check server logs and `AUTH_SECRET` | Supply a strong configured secret and correct app origin. |
| OAuth redirect fails | Verify app URL and Google callback registration | Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, callback `/api/auth/google/callback`. |
| Upload/report fails | Verify writable persistent storage and MIME/size limits | Set `FILE_STORAGE_PATH`, signing secret, browser executable where required. |
| Realtime not connecting | Check Socket server, port/origin and browser URL | Run `npm run socket`; configure `SOCKET_CLIENT_ORIGIN` and `VITE_SOCKET_URL`. |
| API returns 401/403 | Inspect bearer/cookie and role | Log in, pass `Authorization: Bearer <token>`, use the correct client/professional/admin account. |
| Address search returns 502 | Check geocoder connectivity/terms | Configure a reachable provider and descriptive user agent. |

For server request correlation, provide the response `x-request-id` with logs.
