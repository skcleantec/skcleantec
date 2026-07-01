import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../../stores/auth';
import { createTelecrmCallNote, fetchTelecrmCallNotes, type TelecrmCallNoteDto } from '../../../api/telecrmSms';
import { crmFieldClass } from '../crmUi';

function fmtNoteTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** 접수·고객 패널 하단에 임베드되는 통화 메모 섹션 */
export function CrmCallMemoSection({
  phone,
  inquiryId,
  resetKey = 0,
}: {
  phone: string;
  inquiryId?: string | null;
  resetKey?: number;
}) {
  const token = getToken();
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<TelecrmCallNoteDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const digits = phone.replace(/\D/g, '');

  const loadHistory = useCallback(async () => {
    if (!token || digits.length < 4) {
      setHistory([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchTelecrmCallNotes(token, digits);
      setHistory(res.items);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [token, digits]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    setDraft('');
  }, [resetKey, digits]);

  const saveNote = async () => {
    if (!token || digits.length < 4) return;
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await createTelecrmCallNote(token, { phone: digits, body: text, inquiryId: inquiryId ?? null });
      setDraft('');
      setMsg('통화 메모를 저장했습니다.');
      await loadHistory();
      window.setTimeout(() => setMsg(null), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-emerald-100/80 pt-4">
      <div>
        <p className="text-fluid-xs font-semibold text-emerald-900">통화 메모</p>
        <p className="text-[10px] text-slate-500">상담 기록 · 고객에게 보내지 않음</p>
      </div>
      <label className="block space-y-1">
        <span className="text-fluid-xs font-medium text-emerald-800">이번 통화</span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="통화 중 메모"
          className={crmFieldClass}
          disabled={saving || digits.length < 4}
        />
      </label>
      <button
        type="button"
        disabled={saving || !draft.trim() || digits.length < 4}
        onClick={() => void saveNote()}
        className="w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-fluid-xs font-semibold text-emerald-900 disabled:opacity-50"
      >
        {saving ? '저장 중…' : '통화 메모 저장'}
      </button>
      {msg ? <p className="text-fluid-xs text-green-700">{msg}</p> : null}
      {err ? <p className="text-fluid-xs text-red-600">{err}</p> : null}

      <div className="border-t border-emerald-100 pt-3">
        <p className="mb-2 text-fluid-xs font-semibold text-emerald-900">통화 메모 이력</p>
        {digits.length < 4 ? (
          <p className="text-fluid-xs text-gray-500">연락처 입력 후 이력이 표시됩니다.</p>
        ) : loading ? (
          <p className="text-fluid-xs text-gray-500">불러오는 중…</p>
        ) : history.length === 0 ? (
          <p className="text-fluid-xs text-gray-500">저장된 통화 메모가 없습니다.</p>
        ) : (
          <ul className="max-h-40 space-y-2 overflow-y-auto">
            {history.map((row) => (
              <li key={row.id} className="rounded-lg border border-emerald-100 bg-white/80 p-2.5">
                <p className="text-[10px] tabular-nums text-emerald-700">{fmtNoteTime(row.createdAt)}</p>
                <p className="mt-1 whitespace-pre-wrap text-fluid-xs text-gray-800">{row.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** @deprecated 접수 패널 내부 CrmCallMemoSection 사용 */
export function CrmCallMemoPanel(props: {
  phone: string;
  inquiryId?: string | null;
  resetKey?: number;
}) {
  return <CrmCallMemoSection {...props} />;
}
