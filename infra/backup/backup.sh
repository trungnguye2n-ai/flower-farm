#!/usr/bin/env bash
# One backup: database dump + mirror of the image bucket, then retention.
# Needs PGHOST PGUSER PGPASSWORD PGDATABASE, MC_HOST_store, S3_BUCKET.
set -euo pipefail
keep="${BACKUP_KEEP_DAYS:-14}"
stamp="$(date +%Y%m%d-%H%M)"
mkdir -p /backups/db /backups/images

# Write to .part first so a failed dump never looks like a good one
pg_dump -Fc -f "/backups/db/vuonhoa-${stamp}.dump.part"
mv "/backups/db/vuonhoa-${stamp}.dump.part" "/backups/db/vuonhoa-${stamp}.dump"
echo "db: /backups/db/vuonhoa-${stamp}.dump"

mc mirror --overwrite --quiet "store/${S3_BUCKET}" /backups/images
echo "images: mirrored ${S3_BUCKET} to /backups/images"

find /backups/db -name 'vuonhoa-*.dump' -mtime "+${keep}" -print -delete | sed 's/^/removed: /'
find /backups/db -name '*.part' -mmin +60 -delete

# Optional off-site copy (spec §11), off by default. Set both:
#   BACKUP_REMOTE_HOST=https://ACCESS_KEY:SECRET@s3.example.com
#   BACKUP_REMOTE_PATH=bucket/vuonhoa
if [[ -n "${BACKUP_REMOTE_HOST:-}" && -n "${BACKUP_REMOTE_PATH:-}" ]]; then
  MC_HOST_remote="${BACKUP_REMOTE_HOST}" mc mirror --overwrite --quiet /backups "remote/${BACKUP_REMOTE_PATH}"
  echo "offsite: pushed to remote/${BACKUP_REMOTE_PATH}"
fi
touch /backups/.last-success
echo "backup done ${stamp}"
