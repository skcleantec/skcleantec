import http from 'node:http';
import './env.js';
import { config } from './config/index.js';
import app from './app.js';
import { prisma } from './lib/prisma.js';
import { connectPrismaWithRetry } from './lib/dbConnectWithRetry.js';
import { ensureInquiryStatusEnumForDeploy } from './lib/ensureInquiryStatusEnumForDeploy.js';
import { ensureMissingProfessionalDefaults } from './modules/orderform/defaultProfessionalOptions.js';
import { attachInboxWebSocket } from './modules/realtime/index.js';

async function bootstrap() {
  try {
    await connectPrismaWithRetry(prisma);
    console.log('[db] PostgreSQL 연결됨');
  } catch (err) {
    console.error(
      '[db] 연결 실패 — Docker 로컬이면 `npm run db:up` 후 `npm run db:setup`, 원격(Neon 등)이면 server/.env의 DATABASE_URL·SSL(sslmode=require)을 확인하세요.'
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

  const server = http.createServer(app);
  attachInboxWebSocket(server);
  const listenHost = process.env.LISTEN_HOST || '0.0.0.0';
  server.listen(config.port, listenHost, () => {
    console.log(`Server running on http://${listenHost}:${config.port}`);
    void ensureMissingProfessionalDefaults(prisma).catch((e) =>
      console.error('[startup] 전문 시공 기본 옵션 확인 실패:', e)
    );
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[서버] 포트 ${config.port}이(가) 이미 사용 중입니다. 다른 터미널의 node/tsx를 종료하거나 PORT를 변경하세요.`
      );
    }
    throw err;
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
}

/** Express 4 async 라우트의 DB 일시 오류(P1001 등)가 프로세스 전체를 죽이지 않도록 */
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

void bootstrap();
