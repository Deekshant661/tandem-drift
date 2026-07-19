# Game server image. The client is a static bundle deployed separately
# (npm run build -w @tandem/client → any static host/CDN).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci --omit=dev --workspace @tandem/server --workspace @tandem/shared

FROM node:22-alpine
RUN addgroup -S game && adduser -S game -G game
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
USER game
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["npx", "tsx", "packages/server/src/index.ts"]
