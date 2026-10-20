import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineMdIcon } from '../../../components/ui/LineMdIcon';
import { clearPgPartnerToken, readPgPartnerToken } from './pgPartnerSession';

const INPUT = 'login-field-input mt-1 w-full min-h-11 rounded-lg border border-slate-200 px-3 text-fluid-sm';

export function maskKeptSecret(masked: string | null | undefined): string {
  const value = (masked ?? '').trim();
  if (!value) return '없음';
  if (value.includes('*') || value.includes('•')) return value;
  return `••••${value}`;
}

/** 저장된 키는 일부만 보여주고, 원성 비밀번호를 넣으면 전체를 연다. */
export function PgPartnerSecretValue({
  label,
  masked,
  tenantId,
  rail,
  field,
}: {
  label: string;
  masked: string;
  tenantId: string;
  rail: 'KEYIN' | 'LINK';
  field: 'apiKey' | 'tid' | 'sellerPassword';
}) {
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reveal = () => {
    setBusy(true);
    setError(null);
    void fetch(`/api/public/card-payment/pg-partner/merchants/${encodeURIComponent(tenantId)}/reveal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${readPgPartnerToken()}` },
      body: JSON.stringify({ password, rail }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { error?: string; apiKey?: string; tid?: string; sellerPassword?: string } | null;
        if (res.status === 401 && body?.error?.includes('로그인')) {
          clearPgPartnerToken();
          navigate('/pg-partner', { replace: true });
          return;
        }
        if (!res.ok) throw new Error(body?.error || '비밀번호가 맞지 않습니다.');
        const value = field === 'apiKey' ? body?.apiKey : field === 'tid' ? body?.tid : body?.sellerPassword;
        setShown(value?.trim() ? value : '저장된 값이 없습니다.');
        setAsking(false);
        setPassword('');
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '비밀번호가 맞지 않습니다.'))
      .finally(() => setBusy(false));
  };

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-fluid-2xs text-slate-500">{label}</span>
        <button
          type="button"
          aria-label={shown ? `${label} 숨기기` : `${label} 보기`}
          onClick={() => {
            if (shown) {
              setShown(null);
              setAsking(false);
              return;
            }
            setAsking(true);
          }}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-fluid-2xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          <LineMdIcon name={shown ? 'watch-off' : 'search'} className="size-4" />
          {shown ? '숨기기' : '보기'}
        </button>
      </div>
      <p className="mt-1 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-fluid-xs text-slate-900">{shown ?? masked}</p>
      {asking && !shown ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="text-fluid-2xs text-slate-500">원성 로그인 비밀번호</span>
            <input className={INPUT} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          <button
            type="button"
            onClick={reveal}
            disabled={busy || !password}
            className="min-h-11 rounded-lg bg-slate-900 px-3 text-fluid-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? '확인 중' : '확인'}
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-fluid-2xs text-red-700">{error}</p> : null}
    </div>
  );
}
