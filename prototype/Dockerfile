FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    ALLOW_PUBLIC_BIND=true \
    DATABASE_PROVIDER=sqlite \
    CAPPROJE_DATA_DIR=/app/storage \
    SQLITE_DATABASE_PATH=/app/storage/capproje.sqlite \
    OBJECT_STORAGE_DIR=/app/storage/objects \
    SQLITE_BACKUP_DIR=/app/storage/backups

WORKDIR /app
COPY --from=build --chown=node:node /app /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/storage \
    && chown node:node /app/storage
USER node
EXPOSE 3000

# Veritabanı, yüklenen dosyalar ve yedekler bu dizindedir. VOLUME tanımı, ayrıca
# bir yapılandırma yapılmasa bile konteyner yeniden başlatmalarında verinin
# korunmasını sağlar. Yeniden dağıtımlarda da kalması için barındırma tarafında
# bu yola adlandırılmış bir kalıcı disk bağlanmalıdır.
VOLUME ["/app/storage"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" || exit 1

# Yerel SQLite modunda migration'lar sunucu açılışında uygulanır. Turso yalnızca
# açıkça seçildiğinde ayrı bir migration adımı gerektirir.
CMD ["sh", "-c", "if [ \"$DATABASE_PROVIDER\" = \"turso\" ]; then node scripts/migrate-turso.mjs; fi && npm run start:self-host"]
