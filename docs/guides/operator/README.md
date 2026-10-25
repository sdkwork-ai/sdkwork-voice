# Operator Guide

Deployment, monitoring, and incident response for SDKWork Voice.

## Deployment Profiles

| Profile | Entry | Config |
| --- | --- | --- |
| Standalone server | `cargo run -p sdkwork-api-voice-standalone-gateway` | `deployments/deploy.yaml`, `agent.app.config.json` |
| Container | `deployments/docker/Dockerfile` | `SDKWORK_VOICE_APP_ROOT=/app`, `SDKWORK_DATABASE_*` |
| Embedded | `sdkwork-voice-embedded-bootstrap` router merge | Platform consumer wires IAM + database pools |
| Workers | `@sdkwork/voice-generation-worker`, `@sdkwork/voice-drive-sync-worker` | Backend SDK credentials, poll intervals |

## Required Environment

| Variable | Purpose |
| --- | --- |
| `SDKWORK_DATABASE_URL` | Explicit workspace PostgreSQL URL override |
| `SDKWORK_DATABASE_NAME` | Environment identity (`sdkwork_ai_dev`, `sdkwork_ai_test`, `sdkwork_ai_staging`, or `sdkwork_ai_prod`) |
| `SDKWORK_DATABASE_SCHEMA` | Must equal `SDKWORK_DATABASE_NAME` |
| `VOICE_API_BIND` | HTTP bind (default `0.0.0.0:18096`) |
| `VOICE_API_CORS_ORIGINS` | CORS allowlist |
| `VOICE_WEBHOOK_SECRET` | Provider webhook HMAC |
| `VOICE_DEPLOY_ENV` | `production` blocks webhook dev mode |
| `VOICE_DRIVE_OBJECT_STORE_ROOT` | Local object store for Drive sync processor |

Voice and its embedded Drive module always share the same workspace PostgreSQL database, schema, and process pool.

## Health And Readiness

| Probe | Path | Purpose |
| --- | --- | --- |
| Liveness | `GET /healthz` | Process is running |
| Readiness | `GET /readyz` | Voice database pool reachable |
| Metrics | `GET /metrics` | Prometheus HTTP metrics |

Database lifecycle: `pnpm db:status` / `pnpm db:drift:check`

Container migration-only entrypoint:

```powershell
sdkwork-api-voice-standalone-gateway db-migrate
```

Full verification gate: `pnpm verify`

## Observability

| Variable | Purpose |
| --- | --- |
| `RUST_LOG` / `RUST_LOG` via tracing filter | Log level (default `info`) |
| `VOICE_LOG_FORMAT=json` | Structured JSON logs (also auto-enabled when `VOICE_DEPLOY_ENV=production`) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP HTTP endpoint (requires gateway built with `--features otel`) |

Request logs (`voice_request_log`) store the same `traceId` as HTTP `SdkWorkApiResponse` / `ProblemDetail` envelopes.

## Runbooks

- [Voice production operations](../../runbooks/voice-production-operations.md)

See `../../../sdkwork-specs/DOCUMENTATION_SPEC.md` section 2.
