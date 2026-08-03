# Features

| Feature | Flow, rules and main code |
| --- | --- |
| Authentication | Local register/login/reset/verification plus Google OAuth. Password hashes use scrypt; API routes in `src/backend/api.server.ts`, OAuth in `src/routes/api/auth/`, session helpers in `src/lib/auth-session.server.ts`. |
| Client marketplace | Client profiles, jobs, applications, direct hire, project tracking and reviews. UI `src/client/`; repositories `job-db.server.ts`, `project-request-db.server.ts`, `hire-db.server.ts`. |
| Professional marketplace | Professional discovery/profile, applications, service listings, stats/earnings and payout requests. UI `src/professional/`. Some content is only reachable after role checks. |
| Administration | Dashboard/user/job/payment/report management, verification, categories, notifications and CMS. UI `src/admin/` and `src/routes/admin-*.tsx`; API administration routes are in `src/backend/api.server.ts`. |
| Reports | Table/summary/preview/download/history API plus report components. Exports are stored under the runtime storage directory; browser/Puppeteer selection is environment-dependent. |
| CMS and legal | Website and legal page data/services in `src/lib/website-page-cms.server.ts`, `legal-cms.server.ts`, and CMS schema support. |
| Messaging and calls | Socket.IO rooms, persisted message history, typing/activity/notification events and WebRTC signaling in `server/socket-server.mjs`. No media relay/TURN config was found. |
| Maps/files/notifications | Google Maps browser UI, server geocoding proxy, signed local files, email/browser notifications. See [Integrations](INTEGRATIONS.md). |

Edge cases and failure modes are API validation errors, authorization errors, unavailable SMTP/geocoder/Puppeteer errors, and local filesystem/database availability. Relevant tests are concentrated in `src/backend/api.test.ts`; feature-level UI tests were not found.
