import { useEffect, useRef } from 'react';
import { useInboxRealtime } from './useInboxRealtime';

export type TeamBankDepositRtPayload =
  | {
      event: 'balance_received';
      depositId: string;
      inquiryId: string;
      customerName: string;
      amountWon: number;
      kind: string;
      depositorName: string;
      depositedAt: string;
    }
  | {
      event: 'open_new';
      depositId: string;
      amountWon: number;
      depositorName: string;
      depositedAt: string;
      operatingCompanyName: string | null;
    }
  | { event: 'open_resolved'; depositId: string; resolvedByName: string | null }
  | { event: 'expectation_matched'; inquiryId: string; depositId: string; customerName: string; amountWon: number };

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function parse(detail: unknown): TeamBankDepositRtPayload | null {
  if (!detail || typeof detail !== 'object') return null;
  const o = detail as Record<string, unknown>;
  if (o.type !== 'bank_deposit:team') return null;
  const amountWon = Number(o.amountWon);
  switch (o.event) {
    case 'balance_received':
      if (!str(o.depositId) || !Number.isFinite(amountWon)) return null;
      return {
        event: 'balance_received',
        depositId: str(o.depositId),
        inquiryId: str(o.inquiryId),
        customerName: str(o.customerName),
        amountWon,
        kind: str(o.kind),
        depositorName: str(o.depositorName),
        depositedAt: str(o.depositedAt),
      };
    case 'open_new':
      if (!str(o.depositId) || !Number.isFinite(amountWon)) return null;
      return {
        event: 'open_new',
        depositId: str(o.depositId),
        amountWon,
        depositorName: str(o.depositorName),
        depositedAt: str(o.depositedAt),
        operatingCompanyName: str(o.operatingCompanyName) || null,
      };
    case 'open_resolved':
      if (!str(o.depositId)) return null;
      return { event: 'open_resolved', depositId: str(o.depositId), resolvedByName: str(o.resolvedByName) || null };
    case 'expectation_matched':
      if (!str(o.inquiryId) || !Number.isFinite(amountWon)) return null;
      return {
        event: 'expectation_matched',
        inquiryId: str(o.inquiryId),
        depositId: str(o.depositId),
        customerName: str(o.customerName),
        amountWon,
      };
    default:
      return null;
  }
}

const noop = () => {};

/** 팀장 — 잔금 입금·주인 없는 입금·회사 입금 대기 결과를 실시간으로 받는다. */
export function useTeamBankDepositRealtime(
  token: string | null,
  onEvent: (p: TeamBankDepositRtPayload) => void,
  enabled: boolean,
): void {
  const onRef = useRef(onEvent);
  useEffect(() => {
    onRef.current = onEvent;
  });
  useInboxRealtime(token, noop, enabled && Boolean(token));

  useEffect(() => {
    if (!enabled || !token) return;
    const handler = (ev: Event) => {
      const p = parse((ev as CustomEvent).detail);
      if (p) onRef.current(p);
    };
    window.addEventListener('cbiseo:bank-deposit-team', handler);
    return () => window.removeEventListener('cbiseo:bank-deposit-team', handler);
  }, [token, enabled]);
}
