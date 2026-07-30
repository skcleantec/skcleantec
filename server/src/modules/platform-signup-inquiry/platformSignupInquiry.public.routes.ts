import { Router } from 'express';
import {
  createPlatformSignupInquiry,
  PlatformSignupInquiryError,
} from './platformSignupInquiry.service.js';
import { notifyPlatformSignupInquiryByEmail } from './platformSignupInquiry.email.service.js';

const router = Router();

function clientIp(req: { ip?: string; headers: Record<string, unknown> }): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return req.ip ?? null;
}

/** POST /api/public/signup-inquiries */
router.post('/', async (req, res) => {
  const body = req.body as {
    companyName?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    teamLeaderRange?: string;
    desiredPlan?: string;
    message?: string;
    sourcePageUrl?: string;
    websiteUrl?: string;
  };

  if (typeof body.websiteUrl === 'string' && body.websiteUrl.trim()) {
    res.json({ ok: true });
    return;
  }

  try {
    const row = await createPlatformSignupInquiry({
      companyName: body.companyName ?? '',
      contactName: body.contactName ?? '',
      contactPhone: body.contactPhone ?? '',
      contactEmail: body.contactEmail,
      teamLeaderRange: body.teamLeaderRange,
      desiredPlan: body.desiredPlan,
      message: body.message ?? '',
      sourcePageUrl: body.sourcePageUrl,
      requestIp: clientIp(req),
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });
    res.json({ ok: true, id: row.id });
    void notifyPlatformSignupInquiryByEmail({
      id: row.id,
      companyName: row.companyName,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      contactEmail: row.contactEmail,
      teamLeaderRange: row.teamLeaderRange,
      desiredPlan: row.desiredPlan,
      message: row.message,
      sourcePageUrl: row.sourcePageUrl,
      createdAt: row.createdAt,
    });
  } catch (e) {
    if (e instanceof PlatformSignupInquiryError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    console.error('[public signup-inquiry] create', e);
    res.status(500).json({ error: '접수에 실패했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});

export default router;
