# Runbook — sdkwork-voice deploy / upgrade / rollback (EN)

Environments: `development|test|staging|demo|production`. Commands run on the
local WSL host by default; append `--host ssh://[user@]host[:port]` for remote
targets. Image reference: `registry.sdkwork.com/apps/sdkwork-voice-standalone:0.1.0`
(tag from `sdkwork.app.config.json` → `release.currentVersion`).

> ⚠️ The image build hook is wired, but `deployments/docker/bundle/` (deploy.sh + release.sh + compose + env) is missing yet: complete the bundle before `install`/`upgrade` (see OPERATIONS_SPEC.md §1.2).

## 1. Install (first time)

```bash
bin/docker-deploy.sh install --environment <development|test|staging|demo|production>
bin/docker-deploy.sh install --environment production --yes   # --yes is mandatory in production
```

install syncs the bundle to `/opt/deploy/sdkwork-voice/bundle`, loads the image, starts
instances and waits on the health gate (`/healthz`).

## 2. Upgrade

staging/demo/production capture a pre-change backup automatically (skip with
`--skip-backup`; the skip is recorded as evidence):

```bash
bin/docker-image.sh build
bin/docker-deploy.sh upgrade --environment staging --image-tag 0.1.0
```

## 3. Verify (release gate)

```bash
bin/docker-deploy.sh status --environment staging
bin/doctor.sh --environment staging          # aggregated diagnostics (9 checks)
```

## 4. Rollback

```bash
bin/docker-deploy.sh rollback --environment staging                  # previous ledger version
bin/docker-deploy.sh rollback --environment staging --to 0.1.0       # explicit version
```

Rollback is gated by `/healthz` on the management ports; a failed gate
auto-reverts and appends to `release-state/<env>/ledger.jsonl`. Migrations are
forward-only: across an incompatible schema the only recovery is a data
restore (backup-restore.md).

## 5. Retire

```bash
bin/docker-deploy.sh down --environment staging
bin/docker-deploy.sh stop    --environment staging   # stop (keeps containers and volumes; no repackage)
bin/docker-deploy.sh start   --environment staging   # start a stopped stack (embedded deps first)
bin/docker-deploy.sh restart --environment staging   # restart app instances only (deps stay up)
bin/docker-deploy.sh down --environment staging --purge --yes
```

