#!/usr/bin/env bash
# restore.sh <dump-file> [--images] --yes
# Replaces the live database with the dump (and, with --images, copies the
# mirrored photos back into the bucket). Refuses to run without --yes.
set -euo pipefail
dump="${1:-}"
[[ -f "$dump" ]] || { echo "Không tìm thấy file dump: ${dump}"; exit 1; }
shift
images=no; yes=no
for a in "$@"; do
  case "$a" in
    --images) images=yes ;;
    --yes) yes=yes ;;
  esac
done
[[ "$yes" == yes ]] || { echo "Thao tác này ghi đè database ${PGDATABASE}. Chạy lại với --yes để xác nhận."; exit 1; }

# All or nothing. First turn the whole dump into SQL: a damaged file fails
# here, before the database is touched. Then drop everything the app owns and
# load that SQL in ONE transaction, so an error mid-way rolls back to the
# database as it was, and tables or migration records newer than the dump
# don't survive the restore.
sql_file="$(mktemp /tmp/restore.XXXXXX.sql)"
trap 'rm -f "$sql_file"' EXIT
pg_restore --no-owner --no-acl -f "$sql_file" "$dump"
{
  echo 'DROP SCHEMA IF EXISTS drizzle CASCADE;'
  echo 'DROP SCHEMA IF EXISTS public CASCADE;'
  echo 'CREATE SCHEMA public;'
  grep -v '^CREATE SCHEMA public;$' "$sql_file"
} | psql -q -v ON_ERROR_STOP=1 --single-transaction -d "${PGDATABASE}" > /dev/null
echo "db: restored ${dump} into ${PGDATABASE}"
if [[ "$images" == yes ]]; then
  mc mirror --overwrite --quiet /backups/images "store/${S3_BUCKET}"
  echo "images: copied back into ${S3_BUCKET}"
fi
