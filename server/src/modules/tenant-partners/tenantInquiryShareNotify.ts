import { notifyChangeLogToStaff } from '../realtime/changeLogNotify.js';

/** 수신 테넌트 ADMIN·마케터에 DB 수신 알림 (변경 이력 WS) */
export function notifyTenantShareReceived(params: {
  targetTenantId: string;
  targetInquiryId: string;
  customerName: string;
  partnerName: string;
  sourceInquiryNumberSnapshot: string | null;
  targetInquiryNumber?: string | null;
}): void {
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
  notifyChangeLogToStaff({
    tenantId: params.targetTenantId,
    customerName: params.customerName,
    inquiryId: params.targetInquiryId,
    lines: [`[테넌트DB] ${params.partnerName}에서 접수를 전달받았습니다${noHint}`],
  });
}
