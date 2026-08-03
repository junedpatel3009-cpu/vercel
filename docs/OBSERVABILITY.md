# Observability

`src/backend/api.server.ts` emits structured JSON info logs for API request ID, method, path, status and duration; `src/backend/http.server.ts` emits error details/stack for 5xx responses. `server/socket-server.mjs` logs its startup and socket activity. Health endpoints are `GET /api/health` (server runtime state) and `GET /api/v1/health` (API database-connected assertion).

No metrics, distributed tracing, error-reporting SaaS, readiness endpoint distinct from health, liveness orchestration, alert rules, dashboard configuration or log-retention policy was found. Put structured logs behind a central collector, correlate on `x-request-id`, redact sensitive fields, and add authenticated operational monitoring before production scale.
