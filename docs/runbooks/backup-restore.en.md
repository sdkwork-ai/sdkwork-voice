# Runbook — sdkwork-voice backup & restore (EN)

## 1. Backup

```bash
bin/backup.sh create --environment production            # config + database + volumes, sha256 checksummed
bin/backup.sh list   --environment production
bin/backup.sh verify --environment production            # verify the latest set
```

Backup sets live on the target host under `/opt/deploy/sdkwork-voice/backups/`.
RPO: daily in production plus before every upgrade; RTO: production restore
completes within 4 hours.

## 2. Restore (destructive, requires --yes)

```bash
bin/backup.sh restore --environment production --set <set-name> --yes
bin/docker-deploy.sh install --environment production     # bring the stack back up after restore
```

## 3. Drill

Once per quarter, perform a real restore into a scratch environment (not just
`verify`).

