# Docker Deployment

Build and run the SDKWork Voice API container from the repository root (with sibling SDKWork repositories checked out per `agent.workflow.json`, or after `pnpm install:ci-dependencies` in CI):

```powershell
docker build -f deployments/docker/Dockerfile -t sdkwork-voice:local .
docker run --rm -p 18096:18096 `
  -e SDKWORK_DATABASE_URL=postgresql://sdkwork_ai_dev:sdkworkdev123@host.docker.internal:5432/sdkwork_ai_dev `
  -e SDKWORK_DATABASE_SCHEMA=sdkwork_ai_dev `
  -e VOICE_API_CORS_ORIGINS=http://localhost:5173 `
  sdkwork-voice:local
```

## Probes

| Path | Purpose |
| --- | --- |
| `/healthz` | Liveness — process is running |
| `/readyz` | Readiness — voice database pool reachable (`SELECT 1`) |
| `/metrics` | Prometheus HTTP metrics (sdkwork-web-bootstrap default registry) |

The image ships `/app/database` lifecycle assets, binds `VOICE_API_BIND` (default `0.0.0.0:18096`), and sets `VOICE_DEPLOY_ENV=production` (webhook dev mode blocked).

Database-only migration entrypoint:

```powershell
sdkwork-api-voice-standalone-gateway db-migrate
```

Build with OpenTelemetry export (optional):

```powershell
cargo build --release -p sdkwork-api-voice-standalone-gateway --features otel
```

## Workers

Generation and drive-sync workers are separate Node processes — run `@sdkwork/voice-generation-worker` and `@sdkwork/voice-drive-sync-worker` alongside the API container with backend SDK credentials.

See [voice-production-operations.md](../../docs/runbooks/voice-production-operations.md) for startup order, alerting, and DR.
