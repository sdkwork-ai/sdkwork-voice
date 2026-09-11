# Runbook — sdkwork-voice 备份与恢复（中文）

## 1. 备份

```bash
bin/backup.sh create --environment production            # 配置 + 数据库 + 卷，含 sha256
bin/backup.sh list   --environment production
bin/backup.sh verify --environment production            # 校验最新集合
```

备份集位于目标机 `/opt/deploy/sdkwork-voice/backups/`。RPO：生产每日 + 每次升级前；RTO：生产 4 小时内完成恢复。

## 2. 恢复（破坏性，需 --yes）

```bash
bin/backup.sh restore --environment production --set <集合名> --yes
bin/docker-deploy.sh install --environment production     # 恢复后重新拉起
```

## 3. 演练

每季度在临时环境真实恢复一次（不是只跑 verify）。

