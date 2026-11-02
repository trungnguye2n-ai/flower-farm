#!/usr/bin/env bash
# Restoring an older dump must give exactly the dumped database: no tables or
# migration records from after the dump, and `migrate` must succeed afterwards.
# Works on a scratch database (restore_check); the shop's data is untouched.
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
c() { docker compose -f compose.yaml -f compose.dev.yaml "$@"; }
psqlc() { c exec -T db psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$@"; }
scratch_url="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/restore_check"

psqlc -d "$POSTGRES_DB" -c 'drop database if exists restore_check' -c 'create database restore_check'
c run --rm -T -e DATABASE_URL="$scratch_url" migrate npm run -s db:migrate > /dev/null
c run --rm -T -e DATABASE_URL="$scratch_url" migrate npm run -s db:seed > /dev/null
c run --rm -T -e PGDATABASE=restore_check backup pg_dump -Fc -f /backups/db/restore-check.dump

# A later deploy adds a table and its migration record
psqlc -d restore_check -c 'create table later_feature (id int)' \
  -c "insert into drizzle.__drizzle_migrations (hash, created_at) values ('later', 9999999999999)"

c run --rm -T -e PGDATABASE=restore_check backup restore.sh /backups/db/restore-check.dump --yes > /dev/null

fail=0
later=$(psqlc -d restore_check -tAc "select count(*) from information_schema.tables where table_name = 'later_feature'")
[[ "$later" == 0 ]] && echo "ok: tables from after the dump are gone" || { echo "FAIL: later_feature survived the restore"; fail=1; }
products=$(psqlc -d restore_check -tAc 'select count(*) from products')
[[ "$products" == 4 ]] && echo "ok: dumped rows are back" || { echo "FAIL: products=$products"; fail=1; }
if c run --rm -T -e DATABASE_URL="$scratch_url" migrate npm run -s db:migrate > /dev/null 2>&1; then echo "ok: migrate succeeds after restore"; else echo "FAIL: migrate fails after restore"; fail=1; fi

# A damaged dump must fail and leave the database exactly as it was
c run --rm -T backup sh -c 'head -c 4000 /backups/db/restore-check.dump > /backups/db/broken.dump'
if c run --rm -T -e PGDATABASE=restore_check backup restore.sh /backups/db/broken.dump --yes > /dev/null 2>&1; then
  echo "FAIL: broken dump reported success"; fail=1
else
  after=$(psqlc -d restore_check -tAc 'select count(*) from products')
  [[ "$after" == 4 ]] && echo "ok: broken dump fails and changes nothing" || { echo "FAIL: broken dump left products=$after"; fail=1; }
fi

psqlc -d "$POSTGRES_DB" -c 'drop database restore_check'
c run --rm -T backup rm -f /backups/db/restore-check.dump /backups/db/broken.dump
[[ $fail == 0 ]] && echo "PASS"
exit $fail
