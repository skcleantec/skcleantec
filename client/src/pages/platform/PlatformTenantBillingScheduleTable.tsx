import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  TENANT_BILLING_ADJUSTMENT_TYPE_LABEL,
  TENANT_BILLING_SCHEDULE_STATUS_LABEL,
  TENANT_INVOICE_STATUS_LABEL,
  type TenantBillingAdjustmentType,
} from '@shared/tenantBilling';
import type { BillingScheduleRow, TenantInvoiceRow } from '../../api/platformBilling';

function formatYmd(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function ymdFromIso(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function won(n: number) {
  return `${n.toLocaleString('ko-KR')}원`;
}

function scheduleStatusClass(status: string) {
  if (status === 'PAID') return 'text-emerald-700 bg-emerald-50';
  if (status === 'OVERDUE') return 'text-rose-700 bg-rose-50';
  if (status === 'ISSUED') return 'text-amber-800 bg-amber-50';
  if (status === 'SCHEDULED') return 'text-gray-600 bg-gray-100';
  if (status === 'SKIPPED' || status === 'DEFERRED') return 'text-violet-700 bg-violet-50';
  if (status === 'VOID') return 'text-gray-400 bg-gray-50 line-through';
  return 'text-gray-600 bg-gray-50';
}

type MenuItem = { label: string; danger?: boolean; onSelect: () => void };

function RowMenu({ items, disabled }: { items: MenuItem[]; disabled: boolean }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  if (items.length === 0) return <span className="inline-block w-8" aria-hidden />;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-label="다른 처리"
        aria-haspopup="menu"
        aria-expanded={pos != null}
        onClick={(e) => {
          e.stopPropagation();
          if (pos) {
            setPos(null);
            return;
          }
          const r = e.currentTarget.getBoundingClientRect();
          const width = 176;
          setPos({
            top: Math.min(r.bottom + 4, window.innerHeight - items.length * 36 - 12),
            left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)),
          });
        }}
        className="inline-flex h-7 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40"
      >
        ···
      </button>
      {pos
        ? createPortal(
            <div
              role="menu"
              className="fixed z-50 w-44 rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
              style={{ top: pos.top, left: pos.left }}
              onClick={(e) => e.stopPropagation()}
            >
              {items.map((it) => (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setPos(null);
                    it.onSelect();
                  }}
                  className={`block w-full px-3 py-2 text-left hover:bg-gray-50 ${it.danger ? 'text-rose-600' : 'text-gray-800'}`}
                >
                  {it.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

type Props = {
  schedule: BillingScheduleRow[];
  voidInvoices?: TenantInvoiceRow[];
  saving: boolean;
  onApplyAdjustment: (
    type: TenantBillingAdjustmentType,
    periodStartYmd: string,
    customAmountKrw?: number,
  ) => Promise<void>;
  onVoidAdjustment: (adjustmentId: string) => Promise<void>;
  onIssueInvoice: (periodStartYmd: string) => Promise<void>;
  onConfirmPayment: (periodStartYmd: string) => Promise<void>;
  onVoidInvoice: (invoiceId: string) => Promise<void>;
};

type ViewRow = {
  key: string;
  period: string;
  due: string;
  base: { text: string; exempt: boolean };
  addon: { text: string; exempt: boolean };
  total: string;
  statusLabel: string;
  statusClass: string;
  note: string | null;
  muted: boolean;
  canPay: boolean;
  periodYmd: string | null;
  menu: MenuItem[];
};

export function PlatformTenantBillingScheduleTable({
  schedule,
  voidInvoices = [],
  saving,
  onApplyAdjustment,
  onVoidAdjustment,
  onIssueInvoice,
  onConfirmPayment,
  onVoidInvoice,
}: Props) {
  if (schedule.length === 0 && voidInvoices.length === 0) {
    return <p className="px-5 py-6 text-sm text-gray-500">과금 시작일을 정하면 청구 일정이 표시돼요.</p>;
  }

  const rows: ViewRow[] = schedule.map((row) => {
    const periodYmd = ymdFromIso(row.periodStart);
    const hasAdj = row.adjustment != null;
    const canAdjust =
      !hasAdj &&
      row.status !== 'PAID' &&
      row.status !== 'SKIPPED' &&
      row.status !== 'DEFERRED' &&
      row.status !== 'VOID';
    const canIssue =
      !row.invoiceId && row.status !== 'SKIPPED' && row.status !== 'DEFERRED' && row.amountKrw > 0;
    const canPay =
      row.amountKrw > 0 &&
      row.status !== 'PAID' &&
      row.status !== 'SKIPPED' &&
      row.status !== 'DEFERRED' &&
      row.status !== 'VOID';
    const canVoidInvoice =
      row.invoiceId != null && row.status !== 'PAID' && row.status !== 'VOID' && row.status !== 'SKIPPED';

    const menu: MenuItem[] = [];
    if (canIssue) menu.push({ label: '청구서 발행', onSelect: () => void onIssueInvoice(periodYmd) });
    if (canAdjust) {
      menu.push({ label: '이 회차만 면제', onSelect: () => void onApplyAdjustment('SKIP', periodYmd) });
      menu.push({ label: '금액 변경', onSelect: () => void onApplyAdjustment('CUSTOM_AMOUNT', periodYmd) });
      menu.push({ label: '다음 달로 미루기', onSelect: () => void onApplyAdjustment('DEFER_SHIFT', periodYmd) });
      menu.push({ label: '다음 회차에 합치기', onSelect: () => void onApplyAdjustment('DEFER_MERGE', periodYmd) });
    }
    if (canVoidInvoice) {
      menu.push({ label: '청구서 취소', danger: true, onSelect: () => void onVoidInvoice(row.invoiceId!) });
    } else if (hasAdj && !row.invoiceId) {
      const adjLabel = TENANT_BILLING_ADJUSTMENT_TYPE_LABEL[row.adjustment!.type];
      menu.push({
        label: `${adjLabel} 취소`,
        danger: true,
        onSelect: () => void onVoidAdjustment(row.adjustment!.id),
      });
    }

    const skippedByAdj = row.adjustment?.type === 'SKIP';
    const baseAmt = row.baseAmountKrw ?? row.amountKrw;
    const addonAmt = row.addonAmountKrw ?? 0;
    const baseExempt = skippedByAdj || (row.feeExempt === true && baseAmt === 0);
    const addonExempt = skippedByAdj || row.addonExempt === true;
    const statusLabel =
      TENANT_BILLING_SCHEDULE_STATUS_LABEL[row.status] ??
      TENANT_INVOICE_STATUS_LABEL[row.status as keyof typeof TENANT_INVOICE_STATUS_LABEL] ??
      row.status;

    return {
      key: `${row.periodStart}-${row.status}-${row.invoiceId ?? 'x'}`,
      period: `${formatYmd(row.periodStart)} ~ ${formatYmd(row.periodEnd)}`,
      due: formatYmd(row.dueDate),
      base: { text: baseExempt ? '면제' : won(baseAmt), exempt: baseExempt },
      addon: {
        text: addonExempt ? '면제' : addonAmt > 0 ? won(addonAmt) : '—',
        exempt: addonExempt,
      },
      total: won(row.amountKrw),
      statusLabel,
      statusClass: scheduleStatusClass(row.status),
      note: row.adjustment
        ? `${TENANT_BILLING_ADJUSTMENT_TYPE_LABEL[row.adjustment.type]} · ${row.adjustment.reason}`
        : null,
      muted: false,
      canPay,
      periodYmd,
      menu,
    };
  });

  const voidRows: ViewRow[] = voidInvoices.map((inv) => ({
    key: `void-${inv.id}`,
    period: `${formatYmd(inv.periodStart)} ~ ${formatYmd(inv.periodEnd)}`,
    due: formatYmd(inv.dueDate),
    base: { text: won(inv.amountKrw), exempt: false },
    addon: { text: '—', exempt: false },
    total: won(inv.amountKrw),
    statusLabel: TENANT_INVOICE_STATUS_LABEL.VOID,
    statusClass: scheduleStatusClass('VOID'),
    note: null,
    muted: true,
    canPay: false,
    periodYmd: null,
    menu: [],
  }));

  const all = [...rows, ...voidRows];

  const amountCell = (c: { text: string; exempt: boolean }) => (
    <span className={c.exempt ? 'text-violet-600' : undefined}>{c.text}</span>
  );

  const actions = (r: ViewRow) => (
    <div className="inline-flex items-center gap-1">
      {r.canPay && r.periodYmd ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void onConfirmPayment(r.periodYmd!)}
          className="whitespace-nowrap rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-40"
        >
          입금완료
        </button>
      ) : null}
      <RowMenu items={r.menu} disabled={saving} />
    </div>
  );

  return (
    <>
      {/* PC */}
      <div className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500">
              <th className="px-5 py-2.5 text-left font-medium">이용 기간</th>
              <th className="px-3 py-2.5 text-left font-medium">납부일</th>
              <th className="px-3 py-2.5 text-right font-medium">이용료</th>
              <th className="px-3 py-2.5 text-right font-medium">부가 요금</th>
              <th className="px-3 py-2.5 text-right font-medium">합계</th>
              <th className="px-3 py-2.5 text-center font-medium">상태</th>
              <th className="px-5 py-2.5 text-right font-medium">처리</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {all.map((r) => (
              <tr key={r.key} className={`border-t border-gray-100 ${r.muted ? 'text-gray-400' : 'text-gray-800'}`}>
                <td className="whitespace-nowrap px-5 py-3">{r.period}</td>
                <td className="whitespace-nowrap px-3 py-3">{r.due}</td>
                <td className="px-3 py-3 text-right">{amountCell(r.base)}</td>
                <td className="px-3 py-3 text-right">{amountCell(r.addon)}</td>
                <td className={`px-3 py-3 text-right ${r.muted ? '' : 'font-semibold text-gray-900'}`}>{r.total}</td>
                <td className="px-3 py-3 text-center">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${r.statusClass}`}>
                    {r.statusLabel}
                  </span>
                  {r.note ? (
                    <div className="mx-auto mt-0.5 max-w-[140px] truncate text-[11px] text-violet-700" title={r.note}>
                      {r.note}
                    </div>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right">{r.muted ? <span className="text-gray-300">—</span> : actions(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 */}
      <div className="divide-y divide-gray-100 tabular-nums md:hidden">
        {all.map((r) => (
          <div key={r.key} className={`px-4 py-3.5 ${r.muted ? 'text-gray-400' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{r.period}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${r.statusClass}`}>
                {r.statusLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              납부일 {r.due} · 이용료 {amountCell(r.base)} · 부가 요금 {amountCell(r.addon)}
            </p>
            {r.note ? <p className="mt-0.5 truncate text-[11px] text-violet-700">{r.note}</p> : null}
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className={`text-[15px] font-bold ${r.muted ? 'font-normal' : 'text-gray-900'}`}>{r.total}</p>
              {r.muted ? null : actions(r)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
