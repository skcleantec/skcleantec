import { useEffect, useRef } from 'react';
import { useInboxRealtime } from './useInboxRealtime';
import type { BankDepositKind, BankDepositStatus } from '../api/bankDeposits';

export type BankDepositRtPayload = {
  id: string;
  status: BankDepositStatus;
  amountWon: number;
  depositorName: string;
  operatingCompanyId: string | null;
  linkedInquiryId: string | null;
  linkedKind: BankDepositKind | null;
  /** 연결된 고객·담당 마케터·브랜드 이름. 서버가 주면 알림에 쓴다 */
  customerName?: string | null;
  marketerName?: string | null;
  operatingCompanyName?: string | null;
  /** 재직 팀장 전원이 「내 건 아니에요」 */
  noOwner?: boolean;
  /** 팀장이 자기 고객 입금으로 확인했으면 그 이름 */
  claimedByTeamLeaderName?: string | null;
  /** 새 입금인지, 연결이 바뀐 것인지, 지워진 것인지. 서버가 안 주면 undefined */
  event?: 'new' | 'changed' | 'deleted';
};

function parse(detail: unknown): BankDepositRtPayload | null {
  if (!detail || typeof detail !== 'object') return null;
  const o = detail as Record<string, unknown>;
  if (o.type !== 'bank_deposit' || typeof o.id !== 'string') return null;
  if (o.event === 'deleted') {
    return {
      id: o.id,
      status: 'IGNORED',
      amountWon: 0,
      depositorName: '',
      operatingCompanyId: null,
      linkedInquiryId: null,
      linkedKind: null,
      event: 'deleted',
    };
  }
  const amountWon = Number(o.amountWon);
  if (!Number.isFinite(amountWon)) return null;
  return {
    id: o.id,
    status: (typeof o.status === 'string' ? o.status : 'NEEDS_REVIEW') as BankDepositStatus,
    amountWon,
    depositorName: typeof o.depositorName === 'string' ? o.depositorName : '',
    operatingCompanyId: typeof o.operatingCompanyId === 'string' ? o.operatingCompanyId : null,
    linkedInquiryId: typeof o.linkedInquiryId === 'string' ? o.linkedInquiryId : null,
    linkedKind: typeof o.linkedKind === 'string' ? (o.linkedKind as BankDepositKind) : null,
    customerName: typeof o.customerName === 'string' && o.customerName.trim() ? o.customerName.trim() : null,
    marketerName: typeof o.marketerName === 'string' && o.marketerName.trim() ? o.marketerName.trim() : null,
    operatingCompanyName:
      typeof o.operatingCompanyName === 'string' && o.operatingCompanyName.trim() ? o.operatingCompanyName.trim() : null,
    ...(o.noOwner === true ? { noOwner: true } : {}),
    claimedByTeamLeaderName:
      typeof o.claimedByTeamLeaderName === 'string' && o.claimedByTeamLeaderName.trim() ? o.claimedByTeamLeaderName.trim() : null,
    ...(o.event === 'new' || o.event === 'changed' || o.event === 'deleted' ? { event: o.event } : {}),
  };
}

const noop = () => {};

/** 입금이 들어오거나 연결 상태가 바뀌면 알린다. 직원 소켓 하나를 같이 쓴다. */
export function useBankDepositRealtime(
  token: string | null,
  onDeposit: (p: BankDepositRtPayload) => void,
  enabled: boolean,
): void {
  const onRef = useRef(onDeposit);
  useEffect(() => {
    onRef.current = onDeposit;
  });
  // 이 화면만 열려 있어도 소켓이 붙어 있게 한다.
  useInboxRealtime(token, noop, enabled && Boolean(token));

  useEffect(() => {
    if (!enabled || !token) return;
    const handler = (ev: Event) => {
      const p = parse((ev as CustomEvent).detail);
      if (p) onRef.current(p);
    };
    window.addEventListener('cbiseo:bank-deposit', handler);
    return () => window.removeEventListener('cbiseo:bank-deposit', handler);
  }, [token, enabled]);
}
