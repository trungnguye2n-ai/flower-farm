#!/usr/bin/env bash
# Runs backup.sh every day at BACKUP_AT (default 03:00, container TZ = Asia/Ho_Chi_Minh).
set -uo pipefail
at="${BACKUP_AT:-03:00}"
while true; do
  now=$(date +%s)
  next=$(date -d "today ${at}" +%s)
  (( next <= now )) && next=$(date -d "tomorrow ${at}" +%s)
  echo "next backup at $(date -d "@${next}" '+%F %R %Z')"
  sleep $(( next - now ))
  backup.sh || echo "BACKUP FAILED at $(date '+%F %R')"
done
