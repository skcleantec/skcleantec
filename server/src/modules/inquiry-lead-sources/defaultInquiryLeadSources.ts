import { prisma } from '../../lib/prisma.js';
import { ensureInquiryLeadSourceDefaultsForAllTenants } from '../inquiry-lead-sources/inquiryLeadSource.service.js';

/** 서버 기동 시 테넌트별 기본 유입경로(숨고·미소 등) 보강 */
export async function ensureMissingInquiryLeadSourceDefaults(
  db: typeof prisma = prisma,
): Promise<void> {
  try {
    await ensureInquiryLeadSourceDefaultsForAllTenants(db);
  } catch (e) {
    console.warn(
      '[startup] 유입경로 기본 옵션 확인 스킵(DB 마이그레이션 필요 또는 스키마 불일치):',
      e instanceof Error ? e.message : e,
    );
  }
}
