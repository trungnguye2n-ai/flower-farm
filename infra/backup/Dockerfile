# pg_dump/pg_restore from the same Postgres major as the database, plus mc.
FROM cgr.dev/chainguard/minio@sha256:0a01100085e30fb08d2f39e39c9f5c9d83a95707f220b007d813b690cd41622d AS mc

FROM postgres:18@sha256:3a4264520e121176619f54ff867d12774bc81e95e7b84db58d63bccdb6144b81
COPY --from=mc /usr/bin/mc /usr/local/bin/mc
COPY backup.sh restore.sh scheduler.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/scheduler.sh \
 && mkdir -p /backups && chown postgres:postgres /backups
ENV TZ=Asia/Ho_Chi_Minh MC_CONFIG_DIR=/tmp/.mc
USER postgres
ENTRYPOINT []
CMD ["scheduler.sh"]
