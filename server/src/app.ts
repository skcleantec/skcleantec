import 'dotenv/config';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// Railway 등 리버스 프록시 뒤에서 X-Forwarded-* 신뢰 (HTTPS 판별·리다이렉트용)
app.set('trust proxy', 1);
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http') {
    res.redirect(301, `https://${req.get('host') ?? ''}${req.originalUrl}`);
    return;
  }
  next();
});

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

// C/S 이미지: Railway Volume 또는 로컬 uploads 폴더 서빙
const uploadDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'uploads');
try {
  fs.mkdirSync(path.join(uploadDir, 'cs'), { recursive: true });
} catch {}
app.use('/uploads', express.static(uploadDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// 프로덕션: React 빌드 (Railway 등에서 cwd·배포 루트에 따라 경로가 달라질 수 있음)
const clientDistCandidates = [
  path.join(__dirname, '../../client/dist'),
  path.join(process.cwd(), 'client/dist'),
  path.join(process.cwd(), '../client/dist'),
];
const clientDir = clientDistCandidates.find((d) => fs.existsSync(d));
if (clientDir) {
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
