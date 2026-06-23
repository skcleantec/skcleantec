import type { Response } from 'express';
import { prisma } from './prisma.js';
import { getDefaultOperatingCompanyId } from '../modules/operating-companies/operatingCompany.service.js';

/** 타업체 정산 API — 영업 브랜드 스코프 (없으면 테넌트 default) */
export async function resolveSettlementOperatingCompanyId(
  res: Response,
  tenantId: string,
  raw: unknown,
): Promise<string | null> {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed) {
    const oc = await prisma.operatingCompany.findFirst({
      where: { id: trimmed, tenantId, isActive: true },
      select: { id: true },
    });
    if (!oc) {
      res.status(400).json({ error: '유효하지 않은 영업 브랜드입니다.' });
      return null;
    }
    return oc.id;
  }
  try {
    return await getDefaultOperatingCompanyId(prisma, tenantId);
  } catch {
    res.status(400).json({ error: '영업 브랜드를 찾을 수 없습니다. operatingCompanyId를 지정해 주세요.' });
    return null;
  }
}
