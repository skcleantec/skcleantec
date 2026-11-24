import { broadcastJsonToStaff } from '../realtime/realtimeHub.js';

/** 화면 갱신용. 문자 원문과 계좌는 넣지 않는다. */
export function notifyBankDeposit(row: {
  tenantId: string;
  event: 'new' | 'changed';
  id: string;
  status: string;
  amountWon: number;
  depositorName: string;
  operatingCompanyId: string | null;
  operatingCompanyName: string | null;
  customerName: string | null;
  marketerName: string | null;
  linkedInquiryId: string | null;
  linkedKind: string | null;
  noOwner?: boolean;
  claimedByTeamLeaderName?: string | null;
  source?: 'sms' | 'scan' | 'notification';
}): void {
  broadcastJsonToStaff(
    {
      type: 'bank_deposit',
      v: 1,
      event: row.event,
      id: row.id,
      status: row.status,
      amountWon: row.amountWon,
      depositorName: row.depositorName,
      operatingCompanyId: row.operatingCompanyId,
      operatingCompanyName: row.operatingCompanyName,
      customerName: row.customerName,
      marketerName: row.marketerName,
      linkedInquiryId: row.linkedInquiryId,
      linkedKind: row.linkedKind,
      ...(row.noOwner ? { noOwner: true } : {}),
      ...(row.claimedByTeamLeaderName ? { claimedByTeamLeaderName: row.claimedByTeamLeaderName } : {}),
      source: row.source ?? 'sms',
    },
    row.tenantId,
  );
}
