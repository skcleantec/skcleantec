import { broadcastJsonToStaff } from '../realtime/realtimeHub.js';

/** 화면 갱신용. 문자 원문과 계좌는 넣지 않는다. */
export function notifyBankDeposit(row: {
  tenantId: string;
  id: string;
  status: string;
  amountWon: number;
  depositorName: string;
  operatingCompanyId: string | null;
  linkedInquiryId: string | null;
  linkedKind: string | null;
}): void {
  broadcastJsonToStaff(
    {
      type: 'bank_deposit',
      v: 1,
      id: row.id,
      status: row.status,
      amountWon: row.amountWon,
      depositorName: row.depositorName,
      operatingCompanyId: row.operatingCompanyId,
      linkedInquiryId: row.linkedInquiryId,
      linkedKind: row.linkedKind,
    },
    row.tenantId,
  );
}
