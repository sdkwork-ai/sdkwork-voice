# Voice Technical Architecture

Status: active
Owner: voice-platform
Updated: 2026-07-04
Specs: `ARCHITECTURE_DECISION_SPEC.md`, `DOCUMENTATION_SPEC.md`, `API_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `DATABASE_FRAMEWORK_SPEC.md`, `DRIVE_SPEC.md`

## 1. Architecture Overview

`sdkwork-voice` is a domain platform repository for speech synthesis, transcription, translation, sound effects, music generation, provider orchestration, webhook ingestion, and Drive-backed artifact persistence.

Runtime layers:

| Layer | Crates / packages | Responsibility |
| --- | --- | --- |
| HTTP plane | `sdkwork-routes-voice-*-api`, `sdkwork-routes-voice-http-auth` | App/backend API handlers via `sdkwork-web-framework` |
| Service | `sdkwork-voice-service` | Operation dispatch, validation, orchestration |
| Agent protocol | `sdkwork-voice-generation-mcp-service` | Provider-neutral MCP tools, resources, prompts, stdio, and Streamable HTTP/SSE |
| Persistence | `sdkwork-voice-generation-repository-sqlx`, `sdkwork-voice-database-host` | SQL repositories via `sdkwork-database` |
| Drive | `sdkwork-voice-artifact-drive-service`, `sdkwork-voice-drive-sync-processor` | AI-generated artifact upload through `sdkwork-drive` |
| Assembly | `sdkwork-voice-embedded-bootstrap`, `sdkwork-api-voice-assembly` | Router composition for platform consumers |
| Standalone server | `sdkwork-api-voice-standalone-gateway` | Production HTTP entry (`VOICE_API_BIND`, default `0.0.0.0:18096`) |
| Contracts | OpenAPI authorities, `@sdkwork/voice-app-sdk`, `@sdkwork/voice-backend-sdk` | SDKWork v3 envelope (`SdkWorkApiResponse`, `ProblemDetail`) |
| Workers | `@sdkwork/voice-generation-worker`, `@sdkwork/voice-drive-sync-worker` | Queued task dispatch and Drive sync retry orchestration |
| Frontend embed | `apps/sdkwork-voice-pc/*` | IM PC speech/market embed surfaces |

## 2. Technology Choices

- **HTTP:** Axum + `sdkwork-web-framework` (dual-token auth, interceptors, traceId)
- **Database:** PostgreSQL via `sdkwork-database` lifecycle (`database/` module, `VOICE_*` env)
- **File storage:** `sdkwork-drive-workspace-service` only; no app-local upload APIs
- **Utilities:** `sdkwork-utils-rust` for HTTP envelope, IDs, datetime, HMAC, SHA-256
- **Provider routing:** injected provider SPI implementations; generated SDK and vendor DTO mapping remain private to L4 adapters
- **Discovery:** Not used until RPC services are introduced

## 3. System Boundaries

Rust speech generation follows L2 service -> L3 provider SPI -> L4 generated-SDK adapter. The
embedded bootstrap is the L5 SDK-client construction boundary. See
`../decisions/ADR-20260719-voice-generation-provider-spi.md`.

- **Owns:** voice app/backend APIs, task lifecycle, artifacts, Drive sync, provider routes, webhooks, SDK families, generation/drive workers
- **Does not own:** IAM, generic Drive platform, provider runtime implementations, non-voice appbase features

The MCP crate depends only on `VoiceGenerationServicePort` and its task-context store port. It does
not construct provider adapters, SDK clients, repositories, gateways, or credentials. The MCP host
owns authentication, authorization, allowed host/origin policy, limits, observability, graceful
shutdown, and any durable task-context store.

## 4. Directory Layout

```text
apps/
  sdkwork-voice-common/packages/   contracts, provider adapter, generation/drive workers
  sdkwork-voice-pc/packages/       PC embed UI, local API proxy, pc-core composition
crates/                            Rust services, routes, repository, gateway
database/                          sdkwork-database module (manifest, contract, migrations)
sdks/                              OpenAPI authorities and generated SDKs
deployments/                       deploy.yaml for standalone/cloud parity
```

## 5. API, SDK, and Data

- Authorities: `sdkwork-voice-app-api`, `sdkwork-voice-backend-api`
- Materializer: `sdks/materialize-voice-v3-openapi-boundaries.mjs` (native v3 envelope)
- Success: `{ code: 0, data, traceId }`; errors: `application/problem+json` with numeric `code`
- Lists: `data.items` + `data.pageInfo`; commands: `data.accepted`
- List filters: `status`, `operation_type`, `sync_status`, `processing_status`, and related query params on list operations

## 6. Security

- App/backend surfaces: dual-token (`Authorization` + `Access-Token`)
- Permission scopes: `voice.tasks.read/write`, `voice.providerRoutes.read/write` enforced when IAM emits scopes
- Tenant isolation: task events, audio artifacts, and request logs are scoped by `tenant_id` (join through `voice_generation_task` where applicable)
- Provider webhooks: public ingress with HMAC signature (`X-Voice-Webhook-Signature`, `VOICE_WEBHOOK_SECRET`, `VOICE_WEBHOOK_DEV_MODE` blocked in production deploy env)
- Webhook events: persisted, processed into task state with idempotent artifact upsert by `(task_id, artifact_index)`, replayable through backend API
- Drive sync fetch: blocks private/loopback URLs and caps downloaded source payloads (100 MiB)
- CORS: `VOICE_API_CORS_ORIGINS` allowlist; wildcard denied
- Secrets: environment / runtime directory only; never in repository

## 7. Async Pipeline

1. App API create operations enqueue `voice_generation_task` rows (`queued`).
2. `@sdkwork/voice-generation-worker` polls backend `tasks.list?status=queued`, invokes provider adapter, reconciles via `tasks.reconcile`.
3. Provider webhooks ingress updates linked tasks from signed callbacks; `providerWebhookEvents.replay` reprocesses stored events.
4. Reconcile creates `voice_audio_artifact` and `voice_artifact_drive_sync` (`pending_upload`) rows.
5. `@sdkwork/voice-drive-sync-worker` polls `artifactDriveSync.list?sync_status=pending_upload` and calls `artifactDriveSync.retry`.
6. When drive sync is enabled, `sdkwork-voice-drive-sync-processor` fetches provider bytes and persists through `sdkwork-voice-artifact-drive-service` into Drive AI-generated spaces using the process-shared workspace PostgreSQL pool.

## 8. Deployment

- Standalone: `cargo run -p sdkwork-api-voice-standalone-gateway` after `pnpm db:bootstrap`
- Infra routes (mounted once on gateway): `/healthz` (liveness), `/readyz` (DB readiness), `/metrics` (Prometheus)
- Workers: run generation and drive-sync workers as separate processes with backend SDK credentials
- Drive sync processor env:
  - `VOICE_DRIVE_SYNC_ENABLED` (default `true`)
  - `VOICE_DRIVE_OBJECT_STORE_ROOT` (default `.data/voice-drive-objects`)
  - `VOICE_DRIVE_OBJECT_STORE_BUCKET` (default `voice-generated`)
- Container: `deployments/docker/Dockerfile` → `sdkwork-api-voice-standalone-gateway` binary + `/app/database`; optional `otel` feature + `OTEL_EXPORTER_OTLP_ENDPOINT`
- Request audit: `voice_request_log.trace_id` aligned with HTTP `traceId` from `sdkwork-web-framework`
- Config: `agent.app.config.json`, `deployments/deploy.yaml`, `SDKWORK_DATABASE_*`

## 9. Verification

```powershell
pnpm verify
cargo run -p sdkwork-api-voice-standalone-gateway
cargo test -p sdkwork-voice-generation-mcp-service
cargo clippy -p sdkwork-voice-generation-mcp-service --all-targets -- -D warnings
node ../sdkwork-specs/tools/check-api-response-envelope.mjs --workspace .
```
