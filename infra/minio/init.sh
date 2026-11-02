#!/bin/sh
# Idempotent: safe to run on every `compose up`.
set -eu
mc mb --ignore-existing "store/${S3_BUCKET}"
mc anonymous set download "store/${S3_BUCKET}/public"
echo "bucket ${S3_BUCKET} ready (public/ readable)"
