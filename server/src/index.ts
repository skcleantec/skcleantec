import http from 'node:http';
import './env.js';
import { config } from './config/index.js';
import app from './app.js';
import { prisma } from './lib/prisma.js';
import { connectPrismaWithRetry } from './lib/dbConnectWithRetry.js';
import { ensurePlatformBootstrapUsers } from './lib/ensurePlatformBootstrap.js';
import { ensureInquiryStatusEnumForDeploy } from './lib/ensureInquiryStatusEnumForDeploy.js';
import { ensureReviewPaybackDeploySchema } from './lib/ensureReviewPaybackDeploySchema.js';
import { ensureMissingProfessionalDefaults } from './modules/orderform/defaultProfessionalOptions.js';
import { ensureMissingInquiryLeadSourceDefaults } from './modules/inquiry-lead-sources/defaultInquiryLeadSources.js';
import { attachInboxWebSocket } from './modules/realtime/index.js';
import {
  parseInspectionRetentionOptionsFromEnv,
  purgeExpiredInspectionChecklists,
} from './modules/inquiry-inspection/inquiryInspection.retention.service.js';
import { isBenignClientAbortError } from './lib/httpClientAbort.js';

async function bootstrap() {
  try {
    await connectPrismaWithRetry(prisma);
    console.log('[db] PostgreSQL 연결됨');
    await ensurePlatformBootstrapUsers(prisma);
  } catch (err) {
    console.error(
      '[db] 연결 실패 — 팀 기본은 server/.env.staging 의 Railway staging Proxy URL 입니다. (STAGING_SETUP.md) Docker 로컬은 사용자가 명시한 경우에만 `npm run db:up` 후 `npm run db:setup`. SSL은 `?sslmode=require` 확인.'
    );
    console.error(err);
    process.exit(1);
  }

  try {
    await ensureInquiryStatusEnumForDeploy(prisma);
  } catch (err) {
    console.error(
      '[db] InquiryStatus enum 보정 실패 — Postgres에 `ORDER_FORM_PENDING`을 추가할 수 없습니다. DB 권한·버전을 확인하거나 마이그레이션 SQL을 수동 실행하세요.'
    );
    console.error(err);
    process.exit(1);
  }

  try {
    await ensureReviewPaybackDeploySchema(prisma);
  } catch (err) {
    console.error(
      '[db] review_payback_requests.review_images 보정 실패 — `npx prisma migrate deploy` 또는 recovery 마이그레이션을 확인하세요.'
    );
    console.error(err);
    process.exit(1);
  }

  const server = http.createServer(app);
  attachInboxWebSocket(server);
  const listenHost = process.env.LISTEN_HOST || '0.0.0.0';
  server.listen(config.port, listenHost, () => {
    console.log(`Server running on http://${listenHost}:${config.port}`);
    void ensureMissingProfessionalDefaults(prisma).catch((e) =>
      console.error('[startup] 전문 시공 기본 옵션 확인 실패:', e)
    );
    void ensureMissingInquiryLeadSourceDefaults(prisma).catch((e) =>
      console.error('[startup] 유입경로 기본 옵션 확인 실패:', e)
    );
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[서버] 포트 ${config.port}이(가) 이미 사용 중입니다. 다른 터미널의 node/tsx를 종료하거나 PORT를 변경하세요.`
      );
      process.exit(1);
    }
    // 그 외 HTTP 서버 오류는 로그만 — 프로세스를 throw로 죽여 재시작 루프에 빠지지 않게 한다.
    console.error('[서버] HTTP 서버 오류:', err);
  });

  /**
   * DB 풀 keepalive — 60초마다 가벼운 SELECT 1.
   * Railway Proxy/TCP keepalive 만료 후 첫 쿼리에서 풀이 재협상되며 생기는
   * 체감 지연(수 초)을 완화한다. 외부 HTTP 핑(UptimeRobot 등)과 별개로
   * 프로세스가 살아 있는 한 풀을 항상 따뜻하게 유지.
   * 환경변수 DB_KEEPALIVE_DISABLED=true 이면 비활성.
   */
  if (process.env.DB_KEEPALIVE_DISABLED !== 'true') {
    const intervalMs = Number.parseInt(process.env.DB_KEEPALIVE_MS ?? '60000', 10) || 60000;
    const keepAlive = setInterval(() => {
      prisma.$queryRaw`SELECT 1`.catch((e) => {
        console.warn('[keepalive] DB ping 실패:', e instanceof Error ? e.message : e);
      });
    }, intervalMs);
    keepAlive.unref();
  }

  /** 완료 검수본 보관 만료 — INSPECTION_RETENTION_CRON_ENABLED=true 시 24h마다 1회 */
  const retentionOpts = parseInspectionRetentionOptionsFromEnv();
  if (retentionOpts.cronEnabled) {
    const dayMs = 24 * 60 * 60 * 1000;
    const runRetention = () => {
      void purgeExpiredInspectionChecklists()
        .then((r) => {
          if (r.scanned > 0 || r.purged > 0) {
            console.info('[inspection-retention] scheduled run', r);
          }
        })
        .catch((e) => console.error('[inspection-retention] scheduled run failed', e));
    };
    const bootDelayMs = Number.parseInt(process.env.INSPECTION_RETENTION_CRON_BOOT_DELAY_MS ?? '120000', 10) || 120_000;
    setTimeout(runRetention, bootDelayMs).unref();
    setInterval(runRetention, dayMs).unref();
    console.info(
      `[inspection-retention] in-process scheduler on (days=${retentionOpts.retentionDays}, batch=${retentionOpts.batchSize})`,
    );
  }
}

/** Express 4 async 라우트의 DB 일시 오류(P1001 등)가 프로세스 전체를 죽이지 않도록 */
process.on('unhandledRejection', (reason) => {
  if (isBenignClientAbortError(reason)) return;
  console.error('[unhandledRejection]', reason);
});

/**
 * WebSocket·타이머 등 비동기 콜백의 미처리 동기 예외가 프로세스를 죽여
 * 504(게이트웨이 타임아웃)·재시작 루프를 만들지 않도록 마지막 방어선.
 * (요청 핸들러 오류는 각 라우트 try/catch + Express에서 처리됨)
 */
process.on('uncaughtException', (err) => {
  if (isBenignClientAbortError(err)) return;
  console.error('[uncaughtException]', err);
});

void bootstrap();
