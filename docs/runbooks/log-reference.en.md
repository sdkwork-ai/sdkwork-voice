# Runbook — sdkwork-voice log reference (EN)

## Reading logs

```bash
bin/docker-deploy.sh logs --environment production --tail 200          # bounded read (default)
bin/docker-deploy.sh logs --environment production --follow            # explicit follow
bin/docker-deploy.sh logs --environment production --export ./out      # export for tickets (redacted)
```

Healthy startup signature: the `app` service binds its
listener, `/healthz` returns 200, and module lifecycles report ready in
order.

## Common failure signatures

| Log signature | Meaning | Fix |
| --- | --- | --- |
| `connection refused ... 5432` / `... 6379` | database / Redis unreachable | `bin/doctor.sh --environment <env>` → ports/config checks |
| `relation "..." does not exist` | migration not applied | check the env database name; migrations are forward-only, restore a backup if needed |
| `/healthz` 503 with a dependency error | postgres/redis not ready | `bin/doctor.sh` health check + dependency container state |
| repeated `panic` + container restarts | startup crash loop | `bin/doctor.sh` resources → restart count; roll back the version |

