import { CASHBILL_COST_KRW, CASHBILL_UNIT_PRICE_KRW } from '@shared/barobillPolicy';
import {
  cashbillTaxKindLabel,
  type CashbillIssueDefaults,
} from '../../api/receiptIssueSettings';
import type { CashbillTaxKind, CashbillUsage } from '../../api/cashbillIssues';

function won(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function usageBadge(usage: CashbillUsage): string {
  if (usage === 'biz') return '지출증빙';
  if (usage === 'voluntary') return '자진발급';
  return '소득공제';
}

export function CashbillIssuePreview({
  customerLabel,
  itemName,
  tradeDate,
  taxKind,
  usage,
  supply,
  vat,
  total,
  defaultsReady,
  defaults,
  issueLabel,
  busy,
  disabled,
  short,
  useWallet,
  balanceKrw,
  onIssue,
  onCharge,
  pageLayout,
}: {
  customerLabel: string;
  itemName: string;
  tradeDate: string;
  taxKind: CashbillTaxKind;
  usage: CashbillUsage;
  supply: number;
  vat: number;
  total: number;
  defaultsReady: boolean;
  defaults: CashbillIssueDefaults;
  issueLabel: string;
  busy: boolean;
  disabled: boolean;
  short: boolean;
  useWallet: boolean;
  balanceKrw: number | null;
  onIssue: () => void;
  onCharge?: () => void;
  /** 발행 페이지 레이아웃 (사이드바 미리보기) */
  pageLayout?: boolean;
}) {
  const taxDiffers = defaultsReady && taxKind !== defaults.taxKind;
  const badgeExempt = taxKind === 'exempt';

  return (
    <section className="rounded-[20px] bg-white px-[22px] py-[20px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[16px] font-bold text-slate-900">발행 미리보기</h3>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ${
            badgeExempt ? 'bg-[#ECFDF5] text-[#047857]' : 'bg-[#EFF6FF] text-[#1D4ED8]'
          }`}
        >
          {cashbillTaxKindLabel(taxKind)} · {usageBadge(usage)}
        </span>
      </div>

      <div className="mt-4 space-y-1.5 text-[13px] text-slate-700">
        <p>
          <span className="text-[#64748B]">고객</span>{' '}
          <span className="font-medium text-slate-900">{customerLabel || '—'}</span>
        </p>
        <p>
          <span className="text-[#64748B]">품목</span>{' '}
          <span className="font-medium text-slate-900">{itemName.trim() || '—'}</span>
        </p>
        <p>
          <span className="text-[#64748B]">거래일</span>{' '}
          <span className="font-medium tabular-nums text-slate-900">{tradeDate}</span>
        </p>
      </div>

      <hr className="my-4 border-0 border-t border-[#F1F5F9]" />

      <div className="space-y-1">
        <p className="text-[13px] text-[#64748B]">
          {taxKind === 'exempt'
            ? '면세 · 부가세 없음'
            : `공급가액 ${won(supply)} · 부가세 ${won(vat)}`}
        </p>
        <p className="text-[24px] font-bold tabular-nums text-slate-900">{won(total)}</p>
      </div>

      {taxDiffers ? (
        <p className="mt-3 rounded-[10px] bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900">
          기본은 {cashbillTaxKindLabel(defaults.taxKind)}인데 {cashbillTaxKindLabel(taxKind)}로 발행해요
        </p>
      ) : null}

      <div className="mt-4">
        {useWallet && short ? (
          <button
            type="button"
            className="h-[46px] w-full min-w-[160px] rounded-[12px] bg-[#1e3a5f] px-5 text-[14px] font-semibold text-white hover:bg-[#152a45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            onClick={() => onCharge?.()}
          >
            충전하기
          </button>
        ) : (
          <button
            type="button"
            className="h-[46px] w-full min-w-[160px] rounded-[12px] bg-[#1e3a5f] px-5 text-[14px] font-semibold text-white hover:bg-[#152a45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:pointer-events-none disabled:opacity-50"
            disabled={busy || disabled}
            onClick={onIssue}
          >
            {issueLabel}
          </button>
        )}
        <p className={`mt-2 text-center text-[12px] ${short ? 'font-medium text-red-700' : 'text-[#64748B]'}`}>
          {useWallet
            ? short
              ? '잔액이 부족합니다'
              : pageLayout
                ? `발행 비용 ${won(CASHBILL_UNIT_PRICE_KRW)} · 발행하면 목록으로 돌아가요`
                : `발행 비용 ${won(CASHBILL_UNIT_PRICE_KRW)} · 지갑에서 빠져요`
            : `원가 ${won(CASHBILL_COST_KRW)}`}
        </p>
        {useWallet && !short && !pageLayout && balanceKrw != null ? (
          <p className="mt-0.5 text-center text-[11px] tabular-nums text-[#94A3B8]">지갑 {won(balanceKrw)}</p>
        ) : null}
      </div>
    </section>
  );
}
