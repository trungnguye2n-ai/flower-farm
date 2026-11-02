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

pg_restore --clean --if-exists --no-owner -d "${PGDATABASE}" "$dump"
echo "db: restored ${dump} into ${PGDATABASE}"
if [[ "$images" == yes ]]; then
  mc mirror --overwrite --quiet /backups/images "store/${S3_BUCKET}"
  echo "images: copied back into ${S3_BUCKET}"
fi
