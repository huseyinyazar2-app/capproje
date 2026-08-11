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
    CAPPROJE_DATA_DIR=/app/storage \
    OBJECT_STORAGE_DIR=/app/storage/objects

WORKDIR /app
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
EXPOSE 3000

CMD ["sh", "-c", "node scripts/migrate-turso.mjs && npm run start:self-host"]
