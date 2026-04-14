import './env.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './modules/auth/auth.routes.js';
import inquiriesRoutes from './modules/inquiries/inquiries.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import assignmentsRoutes from './modules/assignments/assignments.routes.js';
import scheduleRoutes from './modules/schedule/schedule.routes.js';
import teamRoutes from './modules/team/team.routes.js';
import messagesRoutes from './modules/messages/messages.routes.js';
import dayoffsRoutes from './modules/dayoffs/dayoffs.routes.js';
import estimateRoutes from './modules/estimate/estimate.routes.js';
import orderformRoutes from './modules/orderform/orderform.routes.js';
import csRoutes from './modules/cs/cs.routes.js';
import inquiryChangeLogsRoutes from './modules/inquiry-change-logs/inquiryChangeLogs.routes.js';
import advertisingRoutes from './modules/advertising/advertising.routes.js';
import teamsRoutes from './modules/teams/teams.routes.js';
import externalCompaniesRoutes from './modules/external-companies/externalCompanies.routes.js';
import adminNavBadgesRoutes from './modules/admin/adminNavBadges.routes.js';
import celebrationFeedRoutes from './modules/realtime/celebrationFeed.routes.js';
import { prisma } from './lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// 리버스 프록시 뒤의 클라이언트 IP 등 (필요 시)
app.set('trust proxy', 1);
// HTTPS는 Railway 등에서 종료됩니다. 여기서 http→https를 강제하면 X-Forwarded-Proto/Host
// 조합에 따라 리다이렉트 루프나 Location 오류(https:///path)로 빈 화면이 날 수 있어 두지 않습니다.

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/inquiries', inquiriesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/dayoffs', dayoffsRoutes);
app.use('/api/estimate', estimateRoutes);
app.use('/api/orderforms', orderformRoutes);
app.use('/api/cs', csRoutes);
app.use('/api/admin', adminNavBadgesRoutes);
app.use('/api/realtime', celebrationFeedRoutes);
app.use('/api/inquiry-change-logs', inquiryChangeLogsRoutes);
app.use('/api/advertising', advertisingRoutes);
app.use('/api/external-companies', externalCompaniesRoutes);
app.use('/api/teams', teamsRoutes);

// C/S 이미지: Railway Volume 또는 로컬 uploads 폴더 서빙
const uploadDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'uploads');
try {
  fs.mkdirSync(path.join(uploadDir, 'cs'), { recursive: true });
} catch {}
app.use('/uploads', express.static(uploadDir));

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: true });
  } catch (err) {
    console.error('[health] DB 확인 실패:', err);
    res.status(503).json({
      ok: false,
      db: false,
      error: 'database_unavailable',
    });
  }
});

// 프로덕션: React 빌드 (Railway 등에서 cwd·배포 루트에 따라 경로가 달라질 수 있음)
const clientDistCandidates = [
  ...(process.env.CLIENT_DIST ? [path.resolve(process.env.CLIENT_DIST)] : []),
  path.join(__dirname, '../../client/dist'),
  path.join(process.cwd(), 'client/dist'),
  path.join(process.cwd(), '../client/dist'),
];
const clientDir = clientDistCandidates.find((d) => fs.existsSync(d));
if (clientDir) {
  console.info('[app] client 정적 파일:', clientDir);
  app.use(express.static(clientDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDir, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
} else {
  console.warn(
    '[app] client/dist 없음. 시도한 경로:',
    clientDistCandidates.join(' | '),
    '| cwd=',
    process.cwd()
  );
  app.get('/', (_req, res) => {
    res.status(503).type('html').send(
      '<p>프론트 빌드(client/dist)가 없습니다. Railway Root Directory를 저장소 루트로 두고, 빌드에 <code>npm run build</code>(루트)가 포함되는지 확인하세요.</p>'
    );
  });
}

export default app;
