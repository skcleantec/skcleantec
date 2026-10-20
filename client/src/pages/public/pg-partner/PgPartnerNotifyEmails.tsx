import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearPgPartnerToken, readPgPartnerToken } from './pgPartnerSession';

const INPUT = 'login-field-input min-h-11 w-full rounded-lg border border-slate-200 px-3 text-fluid-sm';
const BTN =
  'min-h-11 rounded-lg bg-slate-900 px-3 text-fluid-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${readPgPartnerToken()}`, 'Content-Type': 'application/json' };
}

export function PgPartnerNotifyEmails() {
  const navigate = useNavigate();
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch('/api/public/card-payment/pg-partner/notify-emails', { headers: authHeaders() })
      .then(async (res) => {
        if (res.status === 401) {
          clearPgPartnerToken();
          navigate('/pg-partner', { replace: true });
          return null;
        }
        if (!res.ok) throw new Error('알림 메일을 불러오지 못했습니다.');
        return res.json() as Promise<{ emails: string[] }>;
      })
      .then((data) => {
        if (data) setEmails(data.emails);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '알림 메일을 불러오지 못했습니다.'));
  }, [navigate]);

  const addEmail = () => {
    const next = draft.trim().toLowerCase();
    setDraft('');
    setSaved(null);
    if (!next) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setError('메일 주소를 확인해 주세요.');
      return;
    }
    setError(null);
    setEmails((prev) => (prev.includes(next) ? prev : [...prev, next]));
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch('/api/public/card-payment/pg-partner/notify-emails', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ emails }),
      });
      const body = (await res.json().catch(() => null)) as { emails?: string[]; error?: string } | null;
      if (res.status === 401) {
        clearPgPartnerToken();
        navigate('/pg-partner', { replace: true });
        return;
      }
      if (!res.ok) throw new Error(body?.error || '저장하지 못했습니다.');
      setEmails(body?.emails ?? emails);
      setSaved('저장했습니다. 다음 PG 신청부터 이 주소로 알림이 갑니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void save(e)} className="rounded-2xl border border-slate-200 bg-white p-3">
      <h2 className="text-fluid-sm font-semibold text-slate-900">신청 알림 메일</h2>
      <p className="mt-1 text-fluid-2xs leading-snug text-slate-600">
        PG 신청이 들어오면 아래 주소로 메일이 갑니다. 주소를 더 넣고 저장하면 그 사람도 받습니다.
      </p>
      <ul className="mt-2 space-y-1">
        {emails.map((email) => (
          <li key={email} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-fluid-xs text-slate-800" title={email}>
              {email}
            </span>
            <button
              type="button"
              onClick={() => {
                setSaved(null);
                setEmails((prev) => prev.filter((item) => item !== email));
              }}
              className="min-h-9 shrink-0 rounded-lg border border-slate-200 px-2 text-fluid-2xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              빼기
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="메일 주소"
          className={INPUT}
        />
        <button type="button" onClick={addEmail} className={`${BTN} sm:w-24`}>
          추가
        </button>
      </div>
      {error ? <p className="mt-2 text-fluid-2xs text-red-700">{error}</p> : null}
      {saved ? <p className="mt-2 text-fluid-2xs text-emerald-800">{saved}</p> : null}
      <button type="submit" disabled={busy || emails.length === 0} className={`${BTN} mt-2`}>
        {busy ? '저장 중…' : '알림 메일 저장'}
      </button>
    </form>
  );
}
