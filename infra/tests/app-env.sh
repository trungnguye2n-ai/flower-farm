#!/usr/bin/env bash
# The app and migrate containers must not receive secrets they don't use
# (Postgres superuser password, off-site backup credentials, test DB URL).
set -euo pipefail
cd "$(dirname "$0")/../.."
fail=0
for svc in app migrate; do
  keys=$(DOMAIN=example.test docker compose -f compose.yaml -f compose.prod.yaml config --format json \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(Object.keys(JSON.parse(s).services['$svc'].environment||{}).join(' ')))")
  for bad in BACKUP_REMOTE_HOST BACKUP_REMOTE_PATH POSTGRES_PASSWORD DATABASE_URL_TEST; do
    if [[ " $keys " == *" $bad "* ]]; then echo "FAIL: $svc receives $bad"; fail=1; fi
  done
  for need in DATABASE_URL S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY S3_SECRET_KEY S3_PUBLIC_URL APP_URL; do
    if [[ " $keys " != *" $need "* ]]; then echo "FAIL: $svc is missing $need"; fail=1; fi
  done
done
[[ $fail == 0 ]] && echo "PASS: app/migrate env holds only what they use"
exit $fail
