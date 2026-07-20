import { useState, useEffect, useCallback } from 'react';
import {
  getRecentChangeHistory,
  getChangeHistoryList,
  deleteChangeHistoryEntry,
  type ChangeHistoryItem,
} from '../../api/inquiryChangeLogs';
import { useAdminStaffSession } from '../../hooks/useAdminStaffSession';
import { runWhenIdle } from '../../utils/deferWhenIdle';
import { ConfirmPasswordModal } from './ConfirmPasswordModal';
import { ModalCloseButton } from './ModalCloseButton';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';

function formatWhen(iso: string): string {
  try {
    return formatDateTimeCompactWithWeekday(iso);
  } catch {
    return iso;
  }
}


type Props = {
  token: string;
  variant?: 'default' | 'sidebar';
  compact?: boolean;
};

export function DashboardChangeHistory({ token, variant = 'default', compact = false }: Props) {
  const isSidebar = variant === 'sidebar';
  const isCompact = compact || isSidebar;
  const { isTenantOwner, isSuperAdmin } = useAdminStaffSession();
  const isTenantOwnerOrSuper = isTenantOwner || isSuperAdmin;
  const [recent, setRecent] = useState<ChangeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [fullItems, setFullItems] = useState<ChangeHistoryItem[]>([]);
  const [fullTotal, setFullTotal] = useState(0);
  const [filterName, setFilterName] = useState('');
  const [fullLoading, setFullLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChangeHistoryItem | null>(null);
  const [pwdOpen, setPwdOpen] = useState(false);

  const loadRecent = useCallback(() => {
    setLoading(true);
    setErr(null);
    getRecentChangeHistory(token, 10)
      .then((r) => setRecent(r.items))
      .catch((e) => setErr(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    return runWhenIdle(() => loadRecent());
  }, [loadRecent]);

  async function openModal() {
    setModalOpen(true);
    setFullLoading(true);
    setFilterName('');
    try {
      const r = await getChangeHistoryList(token, { limit: 200, offset: 0 });
      setFullItems(r.items);
      setFullTotal(r.total);
    } catch {
      setFullItems([]);
      setFullTotal(0);
    } finally {
      setFullLoading(false);
    }
  }

  async function applyFilter() {
    setFullLoading(true);
    try {
      const r = await getChangeHistoryList(token, {
        customerName: filterName || undefined,
        limit: 200,
        offset: 0,
      });
      setFullItems(r.items);
      setFullTotal(r.total);
    } finally {
      setFullLoading(false);
    }
  }

  async function handleDeleteConfirm(password: string) {
    if (!deleteTarget) return;
    await deleteChangeHistoryEntry(token, deleteTarget.id, password);
    setDeleteTarget(null);
    setPwdOpen(false);
    loadRecent();
    if (modalOpen) {
      await applyFilter();
    }
  }

  return (
    <>
      <div
        className={`bg-white border border-gray-200 rounded-xl lg:rounded-2xl cursor-pointer hover:shadow-md hover:border-gray-300 transition-all duration-200 shadow-sm shadow-gray-100/50 ${
          isSidebar
            ? 'p-4 flex flex-col min-h-0 max-h-[calc(100dvh-5.5rem)] lg:sticky lg:top-4 lg:w-[468px]'
            : isCompact
              ? 'p-3'
              : 'p-5'
        }`}
        onClick={() => void openModal()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            void openModal();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className={`flex items-center justify-between border-b border-slate-50 shrink-0 ${isCompact ? 'mb-2 pb-2' : 'mb-5 pb-3'}`}>
          <h2 className={`font-semibold text-gray-800 flex items-center gap-1.5 ${isCompact ? 'text-fluid-xs' : 'text-fluid-base'}`}>
            <svg className={`text-indigo-500 shrink-0 ${isCompact ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            접수 변경 이력
          </h2>
          <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-inset ring-slate-500/10 shrink-0">
            {isSidebar ? '전체 보기' : isCompact ? '전체 보기' : '클릭 시 전체 기록 조회'}
          </span>
        </div>
        <div className={isSidebar ? 'min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]' : undefined}>
        {loading && (
          <div className={`flex justify-center items-center ${isSidebar ? 'py-6' : 'py-8'}`}>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
            <span className="ml-2 text-fluid-xs text-gray-400">불러오는 중…</span>
          </div>
        )}
        {err && <p className="text-fluid-sm text-red-600 py-4">{err}</p>}
        {!loading && !err && recent.length === 0 && (
          <p className="text-fluid-sm text-gray-500 py-6 text-center border border-dashed border-gray-100 rounded-xl">
            저장된 변경 이력이 없습니다.
          </p>
        )}
        
        {!loading && !err && recent.length > 0 && (
          <div className={`relative border-l border-slate-200 ml-3 pl-4 ${isCompact ? 'space-y-2 my-1' : 'space-y-4 ml-3.5 pl-6 my-2'}`}>
            {recent.slice(0, isCompact ? 5 : 10).map((row) => (
              <div key={row.id} className="relative group/item">
                <span
                  className={`absolute flex items-center justify-center rounded-full bg-white border-2 border-indigo-500 ring-4 ring-white ${
                    isCompact ? '-left-[22px] top-0.5 h-3 w-3' : '-left-[30px] top-1 h-4 w-4'
                  }`}
                  aria-hidden="true"
                >
                  <span className={`rounded-full bg-indigo-500 ${isCompact ? 'h-1 w-1' : 'h-1.5 w-1.5'}`} />
                </span>
                
                {isCompact ? (
                  <div className="flex flex-col gap-0.5 text-[11px] leading-snug min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-semibold text-slate-800 truncate">{row.actorName ?? '시스템'}</span>
                      {isTenantOwnerOrSuper ? (
                        <button
                          type="button"
                          className="shrink-0 text-[10px] text-red-600 hover:underline font-semibold"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(row);
                            setPwdOpen(true);
                          }}
                        >
                          삭제
                        </button>
                      ) : null}
                    </div>
                    <span className="inline-flex w-fit max-w-full items-center rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-600 truncate">
                      {row.customerName}
                    </span>
                    <span className="text-slate-600 font-medium line-clamp-2">{row.summaryLine}</span>
                    <span className="text-[10px] text-gray-400 tabular-nums">{formatWhen(row.createdAt)}</span>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-fluid-sm">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-semibold text-slate-800">{row.actorName ?? '시스템'}</span>
                      <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {row.customerName}
                      </span>
                      <span className="text-slate-600 break-words font-medium">{row.summaryLine}</span>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                      <span className="text-[11px] text-gray-400 tabular-nums">{formatWhen(row.createdAt)}</span>
                      {isTenantOwnerOrSuper && (
                        <button
                          type="button"
                          className="text-[11px] text-red-600 hover:underline font-semibold"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(row);
                            setPwdOpen(true);
                          }}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setModalOpen(false)}
        >
          <div
            role="dialog"
            className="relative bg-white rounded-2xl border border-slate-100 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalCloseButton onClick={() => setModalOpen(false)} />
            <div className="p-5 border-b border-slate-100 shrink-0 pr-12 bg-slate-50/50">
              <h2 className="text-fluid-sm font-bold text-slate-900">전체 변경 이력</h2>
            </div>
            <div className="p-5 border-b border-slate-100 flex flex-wrap gap-3 items-end bg-white">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-fluid-xs font-semibold text-slate-500 mb-1.5">고객 이름 필터</label>
                <input
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-fluid-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="이름 일부 입력"
                />
              </div>
              <button
                type="button"
                className="px-4 py-2 text-fluid-sm bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                onClick={() => void applyFilter()}
                disabled={fullLoading}
              >
                검색
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 bg-slate-50/30">
              {fullLoading && (
                <div className="py-12 flex justify-center items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
                  <span className="ml-2 text-fluid-xs text-gray-400">불러오는 중…</span>
                </div>
              )}
              {!fullLoading && (
                <p className="text-fluid-xs text-slate-500 mb-3 font-medium">총 {fullTotal}건 (최대 200건까지 표시)</p>
              )}
              <ul className="space-y-4 text-fluid-sm">
                {fullItems.map((row) => (
                  <li key={row.id} className="border border-slate-100 rounded-2xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-slate-950">{row.customerName}</span>
                          <span className="text-fluid-2xs text-slate-400">|</span>
                          <span className="text-fluid-2xs text-slate-500 font-medium">{formatWhen(row.createdAt)}</span>
                          <span className="text-fluid-2xs text-slate-400">|</span>
                          <span className="text-fluid-2xs text-slate-500 font-medium">작업자: {row.actorName ?? '—'}</span>
                        </div>
                        <ul className="mt-2.5 list-disc list-inside text-slate-700 space-y-1 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                          {row.lines.map((line, i) => (
                            <li key={i} className="text-fluid-2xs font-medium">{line}</li>
                          ))}
                        </ul>
                      </div>
                      {isTenantOwnerOrSuper && (
                        <button
                          type="button"
                          className="shrink-0 text-fluid-2xs text-rose-600 hover:underline font-semibold"
                          onClick={() => {
                            setDeleteTarget(row);
                            setPwdOpen(true);
                          }}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {!fullLoading && fullItems.length === 0 && (
                <p className="text-fluid-sm text-gray-500 py-8 text-center bg-white border border-dashed border-gray-100 rounded-2xl">
                  해당 조건의 이력이 없습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmPasswordModal
        open={pwdOpen}
        title="히스토리 삭제"
        confirmLabel="삭제"
        onClose={() => {
          setPwdOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
