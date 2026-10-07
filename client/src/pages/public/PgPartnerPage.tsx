import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';
import { readPgPartnerToken, writePgPartnerToken } from './pg-partner/pgPartnerSession';

const INPUT =
  'login-field-input mt-1 w-full min-h-11 rounded-lg border border-slate-200 px-3 text-fluid-sm';
const BTN =
  'min-h-11 w-full rounded-xl bg-slate-900 px-4 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export function PgPartnerPage() {
  const navigate = useNavigate();
  const { scrollRef, onFieldFocus } = useLoginScrollSurface(true);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (readPgPartnerToken()) return <Navigate to="/pg-partner/applications" replace />;

  return (
    <div ref={scrollRef} onFocusCapture={onFieldFocus} className="login-surface flex min-h-dvh items-center overflow-y-auto bg-slate-100">
      <div className="login-scroll-content mx-auto w-full max-w-md px-4 py-8">
        <form
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setLoginError(null);
            void fetch('/api/public/card-payment/pg-partner/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ loginId, password }),
            })
              .then(async (res) => {
                const body = (await res.json().catch(() => null)) as { error?: string; token?: string } | null;
                if (!res.ok || !body?.token) throw new Error(body?.error || '로그인하지 못했습니다.');
                writePgPartnerToken(body.token);
                setPassword('');
                navigate('/pg-partner/applications', { replace: true });
              })
              .catch((err: unknown) => setLoginError(err instanceof Error ? err.message : '로그인하지 못했습니다.'))
              .finally(() => setBusy(false));
          }}
        >
          <h1 className="text-fluid-base font-semibold text-slate-900">원성페이먼츠</h1>
          <p className="mt-1 text-fluid-xs text-slate-600">PG 신청과 취소·환불을 확인하는 화면입니다.</p>
          <label className="mt-4 block">
            <span className="text-fluid-2xs text-slate-500">아이디</span>
            <input className={INPUT} value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" />
          </label>
          <label className="mt-3 block">
            <span className="text-fluid-2xs text-slate-500">비밀번호</span>
            <input
              className={INPUT}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {loginError ? <p className="mt-3 text-fluid-xs text-red-700">{loginError}</p> : null}
          <button type="submit" className={`${BTN} mt-4`} disabled={busy || !loginId.trim() || !password}>
            {busy ? '확인 중' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
