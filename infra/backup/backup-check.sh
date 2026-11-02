#!/usr/bin/env bash
# Healthy only if a backup succeeded within the last BACKUP_MAX_AGE_MIN minutes (26 h).
max="${BACKUP_MAX_AGE_MIN:-1560}"
[[ -n "$(find /backups/.last-success -mmin "-${max}" 2>/dev/null)" ]]
