import http from 'node:http';
import './env.js';
import { config } from './config/index.js';
import app from './app.js';
import { prisma } from './lib/prisma.js';
import { ensureMissingProfessionalDefaults } from './modules/orderform/defaultProfessionalOptions.js';
import { attachInboxWebSocket } from './modules/realtime/index.js';

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log('[db] PostgreSQL 연결됨');
  } catch (err) {
    console.error(
      '[db] 연결 실패 — `npm run db:up` 후 `npm run db:setup`을 실행했는지, server/.env의 DATABASE_URL이 postgresql://…@localhost:5432/skcleanteck 인지 확인하세요.'
    );
    console.error(err);
    process.exit(1);
  }

  const server = http.createServer(app);
  attachInboxWebSocket(server);
  server.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
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
}

void bootstrap();
