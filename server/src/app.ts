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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// 프로덕션: React 빌드 결과 서빙 (Railway 등)
// client/dist가 있으면 SPA 폴백 (NODE_ENV 무관 - Railway에서 유연하게)
const clientDir = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

export default app;
