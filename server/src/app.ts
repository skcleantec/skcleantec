import './env.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './modules/auth/auth.routes.js';
import inquiriesRoutes from './modules/inquiries/inquiries.routes.js';
import inquiryExcelImportRoutes from './modules/inquiry-excel-import/inquiryExcelImport.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import assignmentsRoutes from './modules/assignments/assignments.routes.js';
import scheduleRoutes from './modules/schedule/schedule.routes.js';
import teamRoutes from './modules/team/team.routes.js';
import messagesRoutes from './modules/messages/messages.routes.js';
import dayoffsRoutes from './modules/dayoffs/dayoffs.routes.js';
import estimateRoutes from './modules/estimate/estimate.routes.js';
import quotationsRoutes from './modules/quotations/quotations.routes.js';
import orderformRoutes from './modules/orderform/orderform.routes.js';
import orderFollowupsRoutes from './modules/order-followups/orderFollowups.routes.js';
import reviewPaybackPublicRoutes from './modules/review-payback/reviewPayback.public.routes.js';
import reviewPaybackAdminRoutes from './modules/review-payback/reviewPayback.admin.routes.js';
import inquiryInspectionPublicRoutes from './modules/inquiry-inspection/inquiryInspection.public.routes.js';
import inquiryInspectionTemplateRoutes from './modules/inquiry-inspection/inquiryInspection.template.routes.js';
import orderFormTemplatesRoutes from './modules/orderform-templates/orderFormTemplates.routes.js';
import csRoutes from './modules/cs/cs.routes.js';
import landingContactRoutes from './modules/landing-contact/landingContact.routes.js';
import landingContactPublicRoutes from './modules/landing-contact/landingContact.public.routes.js';
import inquiryChangeLogsRoutes from './modules/inquiry-change-logs/inquiryChangeLogs.routes.js';
import advertisingRoutes from './modules/advertising/advertising.routes.js';
import teamsRoutes from './modules/teams/teams.routes.js';
import externalCompaniesRoutes from './modules/external-companies/externalCompanies.routes.js';
import tenantPartnersRoutes from './modules/tenant-partners/tenantPartners.routes.js';
import dbMarketplaceRoutes from './modules/db-marketplace/dbMarketplace.routes.js';
import operatingCompaniesRoutes from './modules/operating-companies/operatingCompany.routes.js';
import adminNavBadgesRoutes from './modules/admin/adminNavBadges.routes.js';
import inspectionRetentionCronRoutes from './modules/admin/inspectionRetention.cron.routes.js';
import billingCronRoutes from './modules/billing/billing.cron.routes.js';
import stagingDbImportRoutes from './modules/admin/stagingDbImport.routes.js';
import volumeDiagnosticsRoutes from './modules/admin/volumeDiagnostics.routes.js';
import adminPayrollRoutes from './modules/admin-payroll/adminPayroll.routes.js';
import celebrationFeedRoutes from './modules/realtime/celebrationFeed.routes.js';
import geocodeRoutes from './modules/geocode/geocode.routes.js';
import userCustomCalendarsRoutes from './modules/user-custom-calendars/userCustomCalendars.routes.js';
import serviceZonesRoutes from './modules/service-zones/serviceZone.routes.js';
import teamCrewGroupsRoutes from './modules/team-crew-groups/teamCrewGroups.routes.js';
import crewRoutes from './modules/crew/crew.routes.js';
import eContractAdminRoutes from './modules/e-contract/eContract.admin.routes.js';
import eContractPublicRoutes from './modules/e-contract/eContract.public.routes.js';
import tenantCompanyProfileRoutes from './modules/tenants/tenantCompanyProfile.routes.js';
import tenantStaffAccessRoutes from './modules/tenants/tenantStaffAccess.routes.js';
import tenantSubscriptionRoutes from './modules/tenants/tenantSubscription.routes.js';
import tenantBillingRoutes from './modules/tenants/tenantBilling.routes.js';
import tenantRoutes from './modules/tenants/tenant.routes.js';
import platformAuthRoutes from './modules/platform/platformAuth.routes.js';
import platformTenantsRoutes from './modules/platform/platformTenants.routes.js';
import platformSupportAccessRoutes from './modules/platform/platformSupportAccess.routes.js';
import platformTenantPartnershipsRoutes from './modules/platform/platformTenantPartnerships.routes.js';
import platformDbMarketplaceRoutes from './modules/db-marketplace/platformDbMarketplace.routes.js';
import helpRoutes from './modules/help/help.routes.js';
import helpInquiryPublicRoutes from './modules/help-inquiry/helpInquiry.public.routes.js';
import platformHelpInquiryRoutes from './modules/help-inquiry/platformHelpInquiry.routes.js';
import platformBillingRoutes from './modules/platform/platformBilling.routes.js';
import { resolveHelpScreenshotFilePath } from './modules/help/helpScreenshotsPath.js';
import teamLeaderTrainingAdminRoutes from './modules/team-leader-training/teamLeaderTraining.admin.routes.js';
import marketerPermissionsRoutes from './modules/marketer-permissions/marketerPermissions.routes.js';
import { telecrmRoutes } from './modules/telecrm/telecrm.routes.js';
import { getSoomgoBridgeManifest } from './modules/telecrm/soomgoBridgeManifest.js';
import { mountCustomModuleRoutes } from './modules/custom/index.js';
import { prisma } from './lib/prisma.js';
import { isBenignClientAbortError } from './lib/httpClientAbort.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// 리버스 프록시 뒤의 클라이언트 IP 등 (필요 시)
app.set('trust proxy', 1);
// HTTPS는 Railway 등에서 종료됩니다. 여기서 http→https를 강제하면 X-Forwarded-Proto/Host
// 조합에 따라 리다이렉트 루프나 Location 오류(https:///path)로 빈 화면이 날 수 있어 두지 않습니다.

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/platform/auth', platformAuthRoutes);
app.use('/api/platform/tenants', platformTenantsRoutes);
app.use('/api/platform/support-access', platformSupportAccessRoutes);
app.use('/api/platform/tenant-partnerships', platformTenantPartnershipsRoutes);
app.use('/api/platform/db-marketplace', platformDbMarketplaceRoutes);
app.use('/api/platform/help-inquiry', platformHelpInquiryRoutes);
app.use('/api/platform/billing', platformBillingRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/inquiries', inquiriesRoutes);
app.use('/api/inquiry-excel-import', inquiryExcelImportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/dayoffs', dayoffsRoutes);
app.use('/api/estimate', estimateRoutes);
app.use('/api/quotations', quotationsRoutes);
app.use('/api/orderforms', orderformRoutes);
app.use('/api/orderform-templates', orderFormTemplatesRoutes);
app.use('/api/order-followups', orderFollowupsRoutes);
app.use('/api/public/review-payback', reviewPaybackPublicRoutes);
app.use('/api/public/inspection', inquiryInspectionPublicRoutes);
app.use('/api/inspection-template', inquiryInspectionTemplateRoutes);
app.use('/api/review-paybacks', reviewPaybackAdminRoutes);
app.use('/api/cs', csRoutes);
app.use('/api/landing-contact', landingContactRoutes);
app.use('/api/public/landing-contact', landingContactPublicRoutes);
app.use('/api/admin', adminNavBadgesRoutes);
app.use('/api/admin/cron', inspectionRetentionCronRoutes);
app.use('/api/admin/cron', billingCronRoutes);
app.use('/api/admin', stagingDbImportRoutes);
app.use('/api/admin', volumeDiagnosticsRoutes);
app.use('/api/admin/payroll', adminPayrollRoutes);
app.use('/api/realtime', celebrationFeedRoutes);
app.use('/api/inquiry-change-logs', inquiryChangeLogsRoutes);
app.use('/api/advertising', advertisingRoutes);
app.use('/api/external-companies', externalCompaniesRoutes);
app.use('/api/tenant-partners', tenantPartnersRoutes);
app.use('/api/db-marketplace', dbMarketplaceRoutes);
app.use('/api/operating-companies', operatingCompaniesRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/geocode', geocodeRoutes);
app.use('/api/user-custom-calendars', userCustomCalendarsRoutes);
app.use('/api/service-zones', serviceZonesRoutes);
app.use('/api/team-crew-groups', teamCrewGroupsRoutes);
app.use('/api/crew', crewRoutes);
app.use('/api/admin/tenant-company-profile', tenantCompanyProfileRoutes);
app.use('/api/admin/tenant-staff-access', tenantStaffAccessRoutes);
app.use('/api/admin/marketer-permissions', marketerPermissionsRoutes);
app.use('/api/admin/tenant-subscription', tenantSubscriptionRoutes);
app.use('/api/admin/tenant-billing', tenantBillingRoutes);
app.use('/api/admin/e-contracts', eContractAdminRoutes);
app.use('/api/admin/team-leader-training', teamLeaderTrainingAdminRoutes);
app.use('/api/e-contract', eContractPublicRoutes);
app.use('/api/crm', telecrmRoutes);
app.get('/api/public/soomgo-bridge/manifest', (_req, res) => {
  res.json(getSoomgoBridgeManifest());
});
app.use('/api/help', helpRoutes);
app.use('/api/help/inquiry', helpInquiryPublicRoutes);
mountCustomModuleRoutes(app);

// C/S 이미지: Railway Volume 또는 로컬 uploads 폴더 서빙
const uploadDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'uploads');
try {
  fs.mkdirSync(path.join(uploadDir, 'cs'), { recursive: true });
} catch {}
app.use('/uploads', express.static(uploadDir));

/**
 * 헬스체크 + 워밍 엔드포인트.
 * UptimeRobot 등 외부 핑에서 5분 주기로 호출하면 콜드스타트·풀 유휴를 막을 수 있다.
 * 응답에는 DB 왕복 지연(ms)·uptime(s)·pid 등 진단 정보를 함께 내려준다.
 */
app.get('/api/health', async (_req, res) => {
  const t0 = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbMs = Math.round(performance.now() - t0);
    res.json({
      ok: true,
      db: true,
      dbMs,
      uptimeSec: Math.round(process.uptime()),
      pid: process.pid,
      /** Railway GitHub 배포 시 주입 — 운영/스테이징 배포 커밋 확인용 */
      gitSha: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      gitBranch: process.env.RAILWAY_GIT_BRANCH ?? null,
    });
  } catch (err) {
    console.error('[health] DB 확인 실패:', err);
    res.status(503).json({
      ok: false,
      db: false,
      error: 'database_unavailable',
      uptimeSec: Math.round(process.uptime()),
      pid: process.pid,
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

  /** 교체 스크린샷 — Volume·최신 파일 우선, 브라우저 캐시 방지 */
  app.get('/help/screenshots/:filename', (req, res, next) => {
    const filePath = resolveHelpScreenshotFilePath(req.params.filename);
    if (!filePath) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(filePath, (err) => {
      if (err && !isBenignClientAbortError(err)) next(err);
    });
  });

  app.use(
    express.static(clientDir, {
      setHeaders(res, filePath) {
        const base = path.basename(filePath);
        if (base === 'index.html') {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return;
        }
        if (filePath.includes(`${path.sep}help${path.sep}screenshots${path.sep}`)) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return;
        }
        if (base.endsWith('.webmanifest')) {
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          return;
        }
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(clientDir, 'index.html'), (err) => {
      if (err && !isBenignClientAbortError(err)) next(err);
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

/** sendFile·static·API 응답 중 클라이언트 선행 종료는 무시 — Express 기본 핸들러 stderr 노출 방지 */
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (isBenignClientAbortError(err)) return;
  console.error('[express]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'internal_server_error' });
});

export default app;
