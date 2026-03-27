import { config } from './config/index.js';
import app from './app.js';
import { prisma } from './lib/prisma.js';
import { ensureMissingProfessionalDefaults } from './modules/orderform/defaultProfessionalOptions.js';

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  void ensureMissingProfessionalDefaults(prisma).catch((err) =>
    console.error('[startup] 전문 시공 기본 옵션 확인 실패:', err)
  );
});
