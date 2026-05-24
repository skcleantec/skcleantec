# Railway: Docker 빌드 (Railpack gRPC/OOM 대안)
# 주의: `# syntax=docker/dockerfile:1` 은 BuildKit이 별도 프론트엔드 이미지를 띄움.
# Railway Metal 빌더에서 해당 gRPC가 끊기는 사례가 있어, 표준 파서만 사용한다.
FROM node:22-bookworm-slim AS build

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# prepare-schema.js 가 DB provider 판별용으로 사용 (빌드 시 Postgres 가정)
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV NODE_OPTIONS=--max-old-space-size=6144
ENV CI=true

WORKDIR /app

# 루트 package.json은 로컬 concurrently용 — 이미지 빌드에 불필요(네트워크·레이어 캐시 분리)
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --no-audit --no-fund

COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci --no-audit --no-fund

# lockfile 단계와 분리: 소스 변경 시 위 npm ci 레이어는 그대로 캐시됨
COPY server ./server
COPY client ./client
COPY shared ./shared

WORKDIR /app/server
RUN npm run build && npm prune --omit=dev

WORKDIR /app/client
RUN NODE_ENV=production npm run build

FROM node:22-bookworm-slim AS runner

# Railway Postgres는 최신 메이저 버전인 경우가 많아, Debian 기본 postgresql-client(pg_dump 구버전)로는
# "server version mismatch" 등으로 pg_dump 가 실패할 수 있음 → PGDG 최신 클라이언트 사용
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg openssl \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update -y \
  && apt-get install -y --no-install-recommends postgresql-client \
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
