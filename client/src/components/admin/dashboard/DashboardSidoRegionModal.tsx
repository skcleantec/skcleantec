import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { DashboardSidoRegionDetail } from '../../../api/dashboard';
import { ModalCloseButton } from '../ModalCloseButton';
import { DashboardHorizontalBarChart } from './DashboardMiniBarChart';
import { formatCurrencyKo } from './dashboardDrilldownTypes';

type Props = {
  open: boolean;
  detail: DashboardSidoRegionDetail | null;
  monthTitle: string;
  onClose: () => void;
};

export function DashboardSidoRegionModal({ open, detail, monthTitle, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !detail || typeof document === 'undefined') return null;

  const items = detail.items.map((z) => ({
    key: z.regionKey,
    label: z.label,
    value: z.inquiryCount,
    subLabel: `${z.inquiryCount}건 · ${formatCurrencyKo(z.salesAmount)}`,
  }));
  const totalCount = items.reduce((s, i) => s + i.value, 0);
  const totalSales = detail.items.reduce((s, z) => s + z.salesAmount, 0);
  const isMetro = detail.items.some((i) => i.regionKey.startsWith('gu:'));

  return createPortal(
    <div
      className="fixed inset-0 z-[270] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-sido-region-title"
        className="relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="shrink-0 border-b border-slate-100 px-5 pt-5 pb-4 pr-14">
          <h2 id="dashboard-sido-region-title" className="text-fluid-base font-semibold text-slate-900">
            {detail.label} {isMetro ? '구·군' : '시·군'}별 접수
          </h2>
          <p className="mt-1 text-fluid-2xs text-gray-500">
            {monthTitle} · 접수 주소 기준 · KST
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
              <p className="text-[10px] text-gray-500">접수 건수</p>
              <p className="text-fluid-sm font-bold text-slate-900 tabular-nums">{totalCount}건</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
              <p className="text-[10px] text-gray-500">매출 합계</p>
              <p className="text-fluid-sm font-bold text-slate-900 tabular-nums">{formatCurrencyKo(totalSales)}</p>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
          {items.length > 0 ? (
            <DashboardHorizontalBarChart
              items={items}
              accentClass="bg-red-500"
              formatValue={(n) => `${n}건`}
              ariaLabel={`${detail.label} 하위 지역 접수 건수`}
            />
          ) : (
            <p className="py-8 text-center text-fluid-2xs text-gray-500 border border-dashed border-slate-200 rounded-lg">
              해당 시·도 집계 데이터가 없습니다.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
