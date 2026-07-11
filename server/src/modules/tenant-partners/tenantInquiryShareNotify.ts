import { prisma } from '../../lib/prisma.js';
import { notifyChangeLogToStaff } from '../realtime/changeLogNotify.js';

const TENANT_SHARE_RECEIVED_LOG_PREFIX = '[파트너연계]';

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
  const line = `${TENANT_SHARE_RECEIVED_LOG_PREFIX} ${params.partnerName}에서 접수를 연계받았습니다${noHint}`;

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

const TENANT_SHARE_REVOKED_LOG_PREFIX = '[파트너연계]';

/** 연계 취소 — 송신·수신 테넌트 알림 */
export async function notifyTenantShareRevoked(params: {
  sourceTenantId: string;
  sourceInquiryId: string;
  targetTenantId: string;
  targetInquiryId: string;
  customerName: string;
  partnerName: string;
  sourceInquiryNumber: string | null;
  targetInquiryNumber: string | null;
}): Promise<void> {
  const srcLine = `${TENANT_SHARE_REVOKED_LOG_PREFIX} ${params.partnerName}에 대한 접수 연계를 취소했습니다.`;
  const tgtLine = `${TENANT_SHARE_REVOKED_LOG_PREFIX} ${params.partnerName}에서 접수 연계가 취소되었습니다. (연계 취소됨)`;

  notifyChangeLogToStaff({
    tenantId: params.sourceTenantId,
    customerName: params.customerName,
    inquiryId: params.sourceInquiryId,
    lines: [srcLine],
  });
  notifyChangeLogToStaff({
    tenantId: params.targetTenantId,
    customerName: params.customerName,
    inquiryId: params.targetInquiryId,
    lines: [tgtLine],
  });
}
