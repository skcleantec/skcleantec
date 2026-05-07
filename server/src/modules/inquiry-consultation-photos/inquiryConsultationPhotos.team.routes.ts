import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { listConsultationPhotos } from './inquiryConsultationPhotos.service.js';

const router = Router({ mergeParams: true });

function serialize(row: {
  id: string;
  inquiryId: string;
  secureUrl: string;
  width: number | null;
  height: number | null;
  createdAt: Date;
  uploadedBy: { id: string; name: string };
}) {
  return {
    id: row.id,
    inquiryId: row.inquiryId,
    secureUrl: row.secureUrl,
    width: row.width,
    height: row.height,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 담당 팀장·타업체 — 읽기 전용 목록 */
router.get('/', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const ok = await prisma.inquiry.findFirst({
    where: { id: inquiryId, assignments: { some: { teamLeaderId: userId } } },
    select: { id: true },
  });
  if (!ok) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  const items = await listConsultationPhotos(inquiryId);
  res.json({ items: items.map(serialize) });
});

export default router;
