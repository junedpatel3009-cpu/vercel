# Integrations

| Service | Purpose | Configuration/source | Failure behavior |
| --- | --- | --- | --- |
| SMTP/Nodemailer | Verification, reset, notifications | SMTP variables; `src/backend/email.server.ts`, `src/lib/otp.server.ts`, `notification-email.server.ts` | Email helper returns unavailable in non-production; production can throw when SMTP is absent. |
| Google OAuth | Social login | Google credentials, `src/lib/google-oauth.server.ts`, API routes | Redirect callback clears state and returns a login error query on failure. |
| Google Maps JS | Map/search UI | `VITE_GOOGLE_MAPS_API_KEY`, client/professional profile UI | Browser script loading; key restriction is required. |
| Nominatim/geocoder | Address search proxy | `GEOCODING_API_URL`, `GEOCODING_USER_AGENT`, API router | 502 if provider returns non-OK; no retry/cache found. |
| Socket.IO | Presence, chat, notifications, WebRTC signaling | `server/socket-server.mjs`, socket URL/origin settings | Separate process; no retry/auth policy documented. |
| Puppeteer/Chromium | PDF/report output | report handlers, executable path | Runtime/browser availability determines success. |

No payment-provider SDK, cloud-object-storage SDK, analytics SDK, SMS provider, CRM, or webhook receiver was found. Payment routes are internal records, not confirmed settlement processing.
