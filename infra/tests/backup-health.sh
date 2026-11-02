#!/usr/bin/env bash
# A failed or stalled backup must be visible: the backup container turns
# unhealthy when the last successful run is older than 26 hours.
set -euo pipefail
cd "$(dirname "$0")/../.."
c() { docker compose -f compose.yaml -f compose.dev.yaml "$@"; }
fail=0
c run --rm -T backup backup.sh > /dev/null 2>&1
if c run --rm -T backup backup-check.sh > /dev/null 2>&1; then echo "ok: fresh backup is healthy"; else echo "FAIL: fresh backup reported unhealthy"; fail=1; fi
c run --rm -T backup sh -c 'touch -d "30 hours ago" /backups/.last-success' > /dev/null 2>&1
if c run --rm -T backup backup-check.sh > /dev/null 2>&1; then echo "FAIL: 30 h old backup reported healthy"; fail=1; else echo "ok: stale backup is unhealthy"; fi
health=$(docker inspect --format '{{if .Config.Healthcheck}}{{join .Config.Healthcheck.Test " "}}{{end}}' "$(c ps -q backup)")
if [[ "$health" == *backup-check.sh* ]]; then echo "ok: container healthcheck uses backup-check.sh"; else echo "FAIL: backup container has no healthcheck"; fail=1; fi
c run --rm -T backup backup.sh > /dev/null 2>&1   # leave a fresh marker behind
[[ $fail == 0 ]] && echo "PASS"
exit $fail
