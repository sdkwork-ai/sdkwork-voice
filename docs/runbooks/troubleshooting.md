# Runbook — sdkwork-voice 故障排查（中文）

症状 → `bin/doctor.sh --environment <env>` 检查项 → 处置。

## 1. 实例不健康

```bash
bin/doctor.sh --environment staging
bin/docker-deploy.sh status --environment staging
```

- `health FAIL`：`curl -fsS http://127.0.0.1:<管理端口>/healthz` 复现；`bin/docker-deploy.sh logs --environment staging --tail 200` 看最近错误。

## 2. 端口未监听

```bash
bin/doctor.sh --environment staging          # ports 检查项给出期望端口
```

- 被占用：改 bundle env 文件里的 `*_HOST_PORT` 后 `bin/docker-deploy.sh install` 重放。

## 3. 配置漂移 / 占位符密钥

```bash
bin/config.sh diff --environment staging
bin/config.sh validate --environment staging
bin/config.sh set --environment staging --key <KEY> --value '<真实值>'
```

## 4. 镜像漂移（跑的不是台账版本）

```bash
bin/docker-deploy.sh status --environment staging
```

- status 输出的镜像与发布台账（release ledger）不一致即为 drift 告警：`bin/docker-deploy.sh rollback --environment staging --to <台账版本>`。

