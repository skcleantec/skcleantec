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
  /** 새 입금인지, 연결 상태만 바뀐 것인지. 서버가 안 주면 undefined */
  event?: 'new' | 'changed';
};

function parse(detail: unknown): BankDepositRtPayload | null {
  if (!detail || typeof detail !== 'object') return null;
  const o = detail as Record<string, unknown>;
  if (o.type !== 'bank_deposit' || typeof o.id !== 'string') return null;
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
    ...(o.event === 'new' || o.event === 'changed' ? { event: o.event } : {}),
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
