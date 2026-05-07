# syntax=docker/dockerfile:1
# Railway: Railpack 대신 Docker 빌드 — gRPC "frontend server closed" / OOM 완화
FROM node:22-bookworm-slim AS build

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# prepare-schema.js 가 DB provider 판별용으로 사용 (빌드 시 Postgres 가정)
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV NODE_OPTIONS=--max-old-space-size=6144

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

COPY scripts ./scripts
COPY server ./server
COPY client ./client

WORKDIR /app/server
RUN node scripts/prepare-schema.js && npx prisma generate && npm run build

WORKDIR /app/client
RUN npm run build

FROM node:22-bookworm-slim AS runner

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=4096

COPY --from=build /app/server/package.json ./
COPY --from=build /app/server/package-lock.json ./
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/prisma ./prisma
COPY --from=build /app/server/scripts ./scripts
COPY --from=build /app/client/dist /app/client/dist

CMD ["npm", "run", "start"]
