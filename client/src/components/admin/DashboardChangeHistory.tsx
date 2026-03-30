import { useState, useEffect, useCallback } from 'react';
import {
  getRecentChangeHistory,
  getChangeHistoryList,
  deleteChangeHistoryEntry,
  type ChangeHistoryItem,
} from '../../api/inquiryChangeLogs';
import { getMe } from '../../api/auth';
import { ConfirmPasswordModal } from './ConfirmPasswordModal';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';

function formatWhen(iso: string): string {
  try {
    return formatDateTimeCompactWithWeekday(iso);
  } catch {
    return iso;
  }
}

function oneLineSummary(row: ChangeHistoryItem): string {
  const who = row.actorName ?? '시스템';
  return `${row.customerName} · ${row.summaryLine} · ${formatWhen(row.createdAt)} · ${who}`;
}

type Props = {
  token: string;
};

export function DashboardChangeHistory({ token }: Props) {
  const [recent, setRecent] = useState<ChangeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [fullItems, setFullItems] = useState<ChangeHistoryItem[]>([]);
  const [fullTotal, setFullTotal] = useState(0);
  const [filterName, setFilterName] = useState('');
  const [fullLoading, setFullLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
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
    loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    getMe(token)
      .then((u: { isSuperAdmin?: boolean }) => setIsSuperAdmin(Boolean(u.isSuperAdmin)))
      .catch(() => setIsSuperAdmin(false));
  }, [token]);

  async function openModal() {
    setModalOpen(true);
    setFullLoading(true);
    setFilterName('');
    try {
      const r = await getChangeHistoryList(token, { limit: 200, offset: 0 });
      setFullItems(r.items);
      setFullTotal(r.total);
    } catch (e) {
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
        className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-gray-300 transition-colors"
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium text-gray-800">접수 변경 이력</h2>
          <span className="text-xs text-gray-500">클릭 시 전체 보기</span>
        </div>
        {loading && <p className="text-sm text-gray-500">불러오는 중…</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
        {!loading && !err && recent.length === 0 && (
          <p className="text-sm text-gray-500">저장된 변경 이력이 없습니다.</p>
        )}
        <ul className="space-y-2 text-sm text-gray-800">
          {recent.map((row) => (
            <li key={row.id} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <span className="flex-1 break-words">{oneLineSummary(row)}</span>
                {isSuperAdmin && (
                  <button
                    type="button"
                    className="shrink-0 text-xs text-red-600 hover:underline"
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
            </li>
          ))}
        </ul>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setModalOpen(false)}
        >
          <div
            role="dialog"
            className="bg-white rounded-lg border border-gray-200 shadow-lg max-w-2xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <h2 className="text-base font-semibold text-gray-900">전체 변경 이력</h2>
              <button
                type="button"
                className="text-sm text-gray-600 hover:text-gray-900"
                onClick={() => setModalOpen(false)}
              >
                닫기
              </button>
            </div>
            <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs text-gray-500 mb-1">고객 이름 필터</label>
                <input
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="이름 일부 입력"
                />
              </div>
              <button
                type="button"
                className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-800"
                onClick={() => void applyFilter()}
                disabled={fullLoading}
              >
                검색
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {fullLoading && <p className="text-sm text-gray-500">불러오는 중…</p>}
              {!fullLoading && (
                <p className="text-xs text-gray-500 mb-2">총 {fullTotal}건 (최대 200건까지 표시)</p>
              )}
              <ul className="space-y-3 text-sm">
                {fullItems.map((row) => (
                  <li key={row.id} className="border border-gray-100 rounded p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-gray-900 font-medium">{row.customerName}</p>
                        <p className="text-gray-600 mt-1">{formatWhen(row.createdAt)} · {row.actorName ?? '—'}</p>
                        <ul className="mt-2 list-disc list-inside text-gray-700">
                          {row.lines.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          className="shrink-0 text-xs text-red-600 hover:underline"
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
                <p className="text-sm text-gray-500">해당 조건의 이력이 없습니다.</p>
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
