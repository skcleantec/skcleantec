import { prisma } from '../../lib/prisma.js';
import { notifyChangeLogToStaff } from '../realtime/changeLogNotify.js';

const TENANT_SHARE_RECEIVED_LOG_PREFIX = '[테넌트DB]';

/** 수신 테넌트 ADMIN·마케터에 DB 수신 알림 (변경 이력 DB + WS) */
export async function notifyTenantShareReceived(params: {
  targetTenantId: string;
  targetInquiryId: string;
  customerName: string;
  partnerName: string;
  sourceInquiryNumberSnapshot: string | null;
  targetInquiryNumber?: string | null;
}): Promise<void> {
  const srcNo = params.sourceInquiryNumberSnapshot?.trim();
  const tgtNo = params.targetInquiryNumber?.trim();
  const noHint =
    srcNo && tgtNo
      ? ` (원번호 ${srcNo} → 수신번호 ${tgtNo})`
      : srcNo
        ? ` (원번호 ${srcNo})`
        : tgtNo
          ? ` (수신번호 ${tgtNo})`
          : '';
  const line = `${TENANT_SHARE_RECEIVED_LOG_PREFIX} ${params.partnerName}에서 접수를 전달받았습니다${noHint}`;

  await prisma.inquiryChangeLog.create({
    data: {
      inquiryId: params.targetInquiryId,
      customerName: params.customerName,
      actorId: null,
      lines: [line],
    },
  });

  notifyChangeLogToStaff({
    tenantId: params.targetTenantId,
    customerName: params.customerName,
    inquiryId: params.targetInquiryId,
    lines: [line],
  });
}
