# Railway: Docker 빌드 (Railpack gRPC/OOM 대안)
# 주의: `# syntax=docker/dockerfile:1` 은 BuildKit이 별도 프론트엔드 이미지를 띄움.
# Railway Metal 빌더에서 해당 gRPC가 끊기는 사례가 있어, 표준 파서만 사용한다.
FROM node:22-bookworm-slim AS build

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# prepare-schema.js 가 DB provider 판별용으로 사용 (빌드 시 Postgres 가정)
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV NODE_OPTIONS=--max-old-space-size=6144

WORKDIR /app

# 루트 package.json은 로컬 concurrently용 — 이미지 빌드에 불필요(이 단계 제거로 설치·네트워크 시간 단축)
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --no-audit --no-fund

COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci --no-audit --no-fund

COPY server ./server
COPY client ./client

WORKDIR /app/server
# npm run build 안에 이미 prepare-schema + prisma generate + tsc 포함 — 이중 실행 제거
RUN npm run build

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
