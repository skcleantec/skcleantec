import { useState, useEffect, useCallback } from 'react';
import {
  getActiveAdSession,
  getAdChannels,
  startAdSession,
  endAdSession,
  type ActiveSession,
  type AdChannel,
} from '../../api/advertising';
import { getToken } from '../../stores/auth';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';

function formatTime(iso: string): string {
  return formatDateTimeCompactWithWeekday(iso);
}

export function TelemarketingSessionBlock() {
  const token = getToken();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [channels, setChannels] = useState<AdChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [active, chRes] = await Promise.all([getActiveAdSession(token), getAdChannels(token)]);
      setSession(active.session);
      setChannels(chRes.items.filter((c) => c.isActive));
      const init: Record<string, string> = {};
      for (const c of chRes.items.filter((x) => x.isActive)) init[c.id] = '';
      setAmounts(init);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleStart = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await startAdSession(token);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '시작 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEnd = () => {
    const init: Record<string, string> = {};
    for (const c of channels) init[c.id] = amounts[c.id] ?? '';
    setAmounts(init);
    setModalOpen(true);
  };

  const handleEnd = async () => {
    if (!token) return;
    const lines = channels
      .map((c) => ({
        channelId: c.id,
        amount: Math.max(0, Math.round(Number(String(amounts[c.id] ?? '').replace(/,/g, '')) || 0)),
      }))
      .filter((l) => l.amount > 0);
    if (lines.length === 0) {
      setError('채널별 금액을 입력해주세요. (합계 0원은 종료할 수 없습니다)');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await endAdSession(token, lines);
      setModalOpen(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '종료 실패');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-base font-medium text-gray-800 mb-2">텔레마케팅 · 광고비</h2>
      <p className="text-sm text-gray-600 mb-4">
        시작하면 본격 업무로 간주하고, 종료 시 당일 채널별 광고비를 입력합니다.
      </p>

      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : session ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-700">
            진행 중 · 시작 {formatTime(session.startedAt)}
          </span>
          <button
            type="button"
            onClick={handleOpenEnd}
            disabled={submitting || channels.length === 0}
            className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded hover:bg-gray-900 disabled:opacity-50"
          >
            작업 종료
          </button>
          {channels.length === 0 && (
            <span className="text-xs text-amber-700">채널이 없습니다. 광고비 메뉴에서 최고 관리자가 채널을 추가하세요.</span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleStart}
          disabled={submitting}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
        >
          시작
        </button>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-2">당일 광고비 입력</h3>
            <p className="text-sm text-gray-600 mb-4">채널별로 금액(원)을 입력하세요. 합계는 0보다 커야 합니다.</p>
            <div className="space-y-3 mb-4">
              {channels.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <label className="flex-1 text-sm text-gray-800">{c.name}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-32 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                    placeholder="0"
                    value={amounts[c.id] ?? ''}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  />
                  <span className="text-xs text-gray-500">원</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                취소
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={() => void handleEnd()}
                disabled={submitting}
              >
                {submitting ? '처리 중…' : '종료 및 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
