import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DashboardRegionDateBasis, DashboardSidoRegionDetail } from '../../../api/dashboard';
import { ModalCloseButton } from '../ModalCloseButton';
import { formatCurrencyKo } from './dashboardDrilldownTypes';
import {
  DashboardRegionDateBasisToggle,
  dashboardRegionDateBasisLabel,
} from './DashboardRegionDateBasisToggle';

type Props = {
  open: boolean;
  detail: DashboardSidoRegionDetail | null;
  monthTitle: string;
  dateBasis: DashboardRegionDateBasis;
  onDateBasisChange: (next: DashboardRegionDateBasis) => void;
  onClose: () => void;
};

function RegionRowBar({
  label,
  count,
  salesAmount,
  maxCount,
  nested,
  expanded,
  onToggle,
}: {
  label: string;
  count: number;
  salesAmount: number;
  maxCount: number;
  nested?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const widthPct = maxCount > 0 ? Math.max(4, Math.round((count / maxCount) * 100)) : 0;
  const hasToggle = onToggle != null;

  return (
    <div className={nested ? 'pl-4' : undefined}>
      <div className="flex items-center gap-2 py-1.5">
        {hasToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-slate-50"
            aria-expanded={expanded}
          >
            <svg
              className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="min-w-0 flex-1 truncate text-fluid-2xs font-medium text-slate-800">{label}</span>
            <span className="shrink-0 tabular-nums text-fluid-2xs font-semibold text-slate-900">{count}건</span>
          </button>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-fluid-2xs text-slate-700">{label}</span>
            <span className="shrink-0 tabular-nums text-fluid-2xs font-semibold text-slate-900">{count}건</span>
          </>
        )}
      </div>
      <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-red-500" style={{ width: `${widthPct}%` }} />
      </div>
      <p className="mb-2 text-[10px] text-slate-400 tabular-nums">{formatCurrencyKo(salesAmount)}</p>
    </div>
  );
}

export function DashboardSidoRegionModal({
  open,
  detail,
  monthTitle,
  dateBasis,
  onDateBasisChange,
  onClose,
}: Props) {
  const [expandedCityKeys, setExpandedCityKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) setExpandedCityKeys(new Set());
  }, [open, detail?.sidoKey, dateBasis]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !detail || typeof document === 'undefined') return null;

  const totalCount = detail.items.reduce((s, i) => s + i.inquiryCount, 0);
  const totalSales = detail.items.reduce((s, z) => s + z.salesAmount, 0);
  const maxCount = Math.max(...detail.items.map((i) => i.inquiryCount), 1);
  const isMetro = detail.items.some((i) => i.regionKey.startsWith('gu:'));

  const toggleCity = (key: string) => {
    setExpandedCityKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 id="dashboard-sido-region-title" className="text-fluid-base font-semibold text-slate-900 min-w-0">
              {detail.label} {isMetro ? '구·군' : '시·군'}별
            </h2>
            <DashboardRegionDateBasisToggle value={dateBasis} onChange={onDateBasisChange} />
          </div>
          <p className="mt-1 text-fluid-2xs text-gray-500">
            {monthTitle} · {dashboardRegionDateBasisLabel(dateBasis)} 기준 · 접수 주소 · KST
          </p>
          {!isMetro ? (
            <p className="mt-1 text-[10px] text-slate-400">시·군 행을 누르면 구 단위로 펼칩니다.</p>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
              <p className="text-[10px] text-gray-500">건수</p>
              <p className="text-fluid-sm font-bold text-slate-900 tabular-nums">{totalCount}건</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
              <p className="text-[10px] text-gray-500">매출 합계</p>
              <p className="text-fluid-sm font-bold text-slate-900 tabular-nums">{formatCurrencyKo(totalSales)}</p>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
          {detail.items.length > 0 ? (
            <div className="space-y-1">
              {detail.items.map((item) => {
                const children = item.children ?? [];
                const expandable = children.length > 0;
                const expanded = expandedCityKeys.has(item.regionKey);
                return (
                  <div key={item.regionKey}>
                    <RegionRowBar
                      label={item.label}
                      count={item.inquiryCount}
                      salesAmount={item.salesAmount}
                      maxCount={maxCount}
                      nested={false}
                      expanded={expandable ? expanded : undefined}
                      onToggle={expandable ? () => toggleCity(item.regionKey) : undefined}
                    />
                    {expandable && expanded ? (
                      <div className="ml-2 border-l border-slate-100 pl-2">
                        {children.map((child) => (
                          <RegionRowBar
                            key={child.regionKey}
                            label={child.label}
                            count={child.inquiryCount}
                            salesAmount={child.salesAmount}
                            maxCount={maxCount}
                            nested
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
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
