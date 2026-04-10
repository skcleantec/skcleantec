import { useState, useCallback } from 'react';
import { ConfirmPasswordModal } from '../../components/admin/ConfirmPasswordModal';
import { getToken } from '../../stores/auth';
import {
  getInquiries,
  getInquiry,
  deleteInquiry,
  bulkDeleteInquiriesByDay,
  bulkDeleteInquiriesByMonth,
} from '../../api/inquiries';

function kstTodayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function kstMonthKey(): string {
  return kstTodayYmd().slice(0, 7);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Mode = 'day' | 'month' | 'one';

type BulkPending = { kind: 'day' | 'month'; label: string; count: number };

type InquiryPick = { id: string; customerName: string; inquiryNumber: string | null };

function pickInquiryFromRow(row: Record<string, unknown>): InquiryPick | null {
  const id = typeof row.id === 'string' ? row.id : '';
  const customerName = typeof row.customerName === 'string' ? row.customerName : '';
  if (!id || !customerName) return null;
  const inquiryNumber =
    row.inquiryNumber === null || row.inquiryNumber === undefined
      ? null
      : String(row.inquiryNumber);
  return { id, customerName, inquiryNumber };
}

export function AdminInquiryBulkDeletePage() {
  const token = getToken();
  const [mode, setMode] = useState<Mode>('day');

  const [dayKey, setDayKey] = useState(() => kstTodayYmd());
  const [monthKey, setMonthKey] = useState(() => kstMonthKey());
  const [dayCount, setDayCount] = useState<number | null>(null);
  const [monthCount, setMonthCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [countError, setCountError] = useState<string | null>(null);

  const [oneQuery, setOneQuery] = useState('');
  const [onePick, setOnePick] = useState<InquiryPick | null>(null);
  const [oneLoading, setOneLoading] = useState(false);
  const [oneError, setOneError] = useState<string | null>(null);

  const [bulkPending, setBulkPending] = useState<BulkPending | null>(null);
  const [oneDeleteOpen, setOneDeleteOpen] = useState(false);

  const refreshDayCount = useCallback(async () => {
    if (!token) return;
    setCountLoading(true);
    setCountError(null);
    try {
      const data = (await getInquiries(token, {
        datePreset: 'day',
        day: dayKey,
        limit: 1,
      })) as { total?: number };
      setDayCount(typeof data.total === 'number' ? data.total : 0);
    } catch (e) {
      setDayCount(null);
      setCountError(e instanceof Error ? e.message : '건수를 불러올 수 없습니다.');
    } finally {
      setCountLoading(false);
    }
  }, [token, dayKey]);

  const refreshMonthCount = useCallback(async () => {
    if (!token) return;
    setCountLoading(true);
    setCountError(null);
    try {
      const data = (await getInquiries(token, {
        datePreset: 'month',
        month: monthKey,
        limit: 1,
      })) as { total?: number };
      setMonthCount(typeof data.total === 'number' ? data.total : 0);
    } catch (e) {
      setMonthCount(null);
      setCountError(e instanceof Error ? e.message : '건수를 불러올 수 없습니다.');
    } finally {
      setCountLoading(false);
    }
  }, [token, monthKey]);

  const handleLookupOne = async () => {
    if (!token) return;
    const q = oneQuery.trim();
    setOneError(null);
    setOnePick(null);
    if (!q) {
      setOneError('접수번호 또는 접수 ID를 입력하세요.');
      return;
    }
    setOneLoading(true);
    try {
      if (UUID_RE.test(q)) {
        const row = (await getInquiry(token, q)) as Record<string, unknown>;
        const p = pickInquiryFromRow(row);
        if (!p) {
          setOneError('접수 정보를 해석할 수 없습니다.');
          return;
        }
        setOnePick(p);
        return;
      }
      const data = (await getInquiries(token, {
        search: q,
        datePreset: 'all',
        limit: 80,
      })) as { items?: Record<string, unknown>[] };
      const items = Array.isArray(data.items) ? data.items : [];
      const exact = items
        .map((row) => pickInquiryFromRow(row))
        .filter((x): x is InquiryPick => x != null)
        .find((x) => x.inquiryNumber === q);
      if (exact) {
        setOnePick(exact);
        return;
      }
      setOneError('일치하는 접수를 찾지 못했습니다. 접수번호 전체 또는 UUID를 입력하세요.');
    } catch (e) {
      setOneError(e instanceof Error ? e.message : '조회에 실패했습니다.');
    } finally {
      setOneLoading(false);
    }
  };

  const modeTab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`px-3 py-2 text-sm font-medium rounded-t border-b-2 -mb-px whitespace-nowrap ${
        mode === m
          ? 'border-gray-800 text-gray-900'
          : 'border-transparent text-gray-500 hover:text-gray-800'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">접수건 삭제</h1>
        <p className="mt-1 text-fluid-sm text-gray-600">
          관리자만 사용할 수 있습니다. 기준은 <strong className="font-medium">접수 등록일(접수일)</strong>의 한국시간(KST)입니다.
          삭제 시 배정·변경 이력·현장 사진 DB 기록이 함께 제거되며 복구할 수 없습니다. C/S 보고는 남고 접수 연결만 끊깁니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200" role="tablist">
        {modeTab('day', '일별')}
        {modeTab('month', '월별')}
        {modeTab('one', '건별')}
      </div>

      {mode === 'day' && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 max-w-lg">
          <div>
            <label className="block text-sm text-gray-600 mb-1">삭제할 접수일 (KST)</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              value={dayKey}
              onChange={(e) => {
                setDayKey(e.target.value);
                setDayCount(null);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshDayCount()}
              disabled={countLoading || !dayKey}
              className="px-3 py-2 text-sm border border-gray-300 rounded text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {countLoading ? '조회 중…' : '해당 일자 건수 조회'}
            </button>
            <button
              type="button"
              onClick={() => {
                const n = dayCount ?? 0;
                setBulkPending({ kind: 'day', label: dayKey, count: n });
              }}
              disabled={!dayKey}
              className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              이 날짜 접수 전부 삭제
            </button>
          </div>
          {countError && <p className="text-sm text-red-600">{countError}</p>}
          {dayCount !== null && (
            <p className="text-fluid-sm text-gray-700">
              해당 일자 접수: <span className="font-medium tabular-nums">{dayCount}</span>건
            </p>
          )}
        </div>
      )}

      {mode === 'month' && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 max-w-lg">
          <div>
            <label className="block text-sm text-gray-600 mb-1">삭제할 월 (KST)</label>
            <input
              type="month"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              value={monthKey}
              onChange={(e) => {
                setMonthKey(e.target.value);
                setMonthCount(null);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshMonthCount()}
              disabled={countLoading || !monthKey}
              className="px-3 py-2 text-sm border border-gray-300 rounded text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {countLoading ? '조회 중…' : '해당 월 건수 조회'}
            </button>
            <button
              type="button"
              onClick={() => {
                const n = monthCount ?? 0;
                setBulkPending({ kind: 'month', label: monthKey, count: n });
              }}
              disabled={!monthKey}
              className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              이 달 접수 전부 삭제
            </button>
          </div>
          {countError && <p className="text-sm text-red-600">{countError}</p>}
          {monthCount !== null && (
            <p className="text-fluid-sm text-gray-700">
              해당 월 접수: <span className="font-medium tabular-nums">{monthCount}</span>건
            </p>
          )}
        </div>
      )}

      {mode === 'one' && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 max-w-lg">
          <div>
            <label className="block text-sm text-gray-600 mb-1">접수번호 또는 접수 ID(UUID)</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="예: 2604100001 또는 UUID"
                value={oneQuery}
                onChange={(e) => setOneQuery(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void handleLookupOne()}
                disabled={oneLoading}
                className="px-3 py-2 text-sm border border-gray-300 rounded text-gray-800 hover:bg-gray-50 disabled:opacity-50 shrink-0"
              >
                {oneLoading ? '조회 중…' : '조회'}
              </button>
            </div>
          </div>
          {oneError && <p className="text-sm text-red-600">{oneError}</p>}
          {onePick && (
            <div className="border border-gray-100 rounded p-3 bg-gray-50 text-fluid-sm space-y-1">
              <p>
                <span className="text-gray-500">고객명</span> {onePick.customerName}
              </p>
              <p>
                <span className="text-gray-500">접수번호</span>{' '}
                <span className="tabular-nums">{onePick.inquiryNumber ?? '—'}</span>
              </p>
              <button
                type="button"
                onClick={() => setOneDeleteOpen(true)}
                className="mt-2 px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                이 접수 삭제
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmPasswordModal
        open={!!bulkPending}
        title={
          bulkPending
            ? bulkPending.kind === 'day'
              ? `「${bulkPending.label}」(KST) 접수 ${bulkPending.count}건을 영구 삭제합니다. 복구할 수 없습니다.`
              : `「${bulkPending.label}」월(KST) 접수 ${bulkPending.count}건을 영구 삭제합니다. 복구할 수 없습니다.`
            : ''
        }
        confirmLabel="삭제 실행"
        onClose={() => setBulkPending(null)}
        onConfirm={async (password) => {
          if (!token || !bulkPending) return;
          if (bulkPending.kind === 'day') {
            const r = await bulkDeleteInquiriesByDay(token, bulkPending.label, password);
            window.alert(`삭제 완료: ${r.deleted}건`);
            await refreshDayCount();
            return;
          }
          const r = await bulkDeleteInquiriesByMonth(token, bulkPending.label, password);
          window.alert(`삭제 완료: ${r.deleted}건`);
          await refreshMonthCount();
        }}
      />

      <ConfirmPasswordModal
        open={oneDeleteOpen}
        title={
          onePick
            ? `「${onePick.customerName}」${
                onePick.inquiryNumber ? ` (${onePick.inquiryNumber})` : ''
              } 접수를 영구 삭제합니다.`
            : ''
        }
        confirmLabel="삭제"
        onClose={() => setOneDeleteOpen(false)}
        onConfirm={async (password) => {
          if (!token || !onePick) return;
          await deleteInquiry(token, onePick.id, password);
          setOneDeleteOpen(false);
          setOnePick(null);
          setOneQuery('');
          window.alert('삭제되었습니다.');
        }}
      />
    </div>
  );
}
