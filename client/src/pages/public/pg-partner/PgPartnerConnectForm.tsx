import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearPgPartnerToken, readPgPartnerToken } from './pgPartnerSession';

const INPUT = 'login-field-input mt-1 w-full min-h-11 rounded-lg border border-slate-200 px-3 text-fluid-sm';
const BTN =
  'min-h-11 rounded-xl bg-slate-900 px-4 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export function PgPartnerConnectForm({
  onboardingId,
  mid: initialMid,
  oid: initialOid,
  clerkCodes: initialCodes,
  onSaved,
}: {
  onboardingId: string;
  mid: string | null;
  oid: string | null;
  clerkCodes: string[];
  onSaved: (next: { mid: string | null; oid: string | null; apiKeyLast4: string | null; clerkCodes: string[] }) => void;
}) {
  const navigate = useNavigate();
  const [mid, setMid] = useState(initialMid ?? '');
  const [oid, setOid] = useState(initialOid ?? '');
  const [apiKey, setApiKey] = useState('');
  const [tid, setTid] = useState('');
  const [clerkCodes, setClerkCodes] = useState<string[]>(
    initialCodes.length === 15 ? initialCodes : Array.from({ length: 15 }, () => ''),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        void fetch(`/api/public/card-payment/pg-partner/applications/${encodeURIComponent(onboardingId)}/codes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${readPgPartnerToken()}` },
          body: JSON.stringify({ mid, oid, apiKey, tid, clerkCodes }),
        })
          .then(async (res) => {
            const body = (await res.json().catch(() => null)) as {
              error?: string;
              mid?: string | null;
              oid?: string | null;
              apiKeyLast4?: string | null;
              clerkCodes?: string[];
            } | null;
            if (res.status === 401) {
              clearPgPartnerToken();
              navigate('/pg-partner', { replace: true });
              return;
            }
            if (!res.ok) throw new Error(body?.error || '코드를 연결하지 못했습니다.');
            setApiKey('');
            setDone('이 업체에 연결했습니다.');
            onSaved({
              mid: body?.mid ?? mid,
              oid: body?.oid ?? oid,
              apiKeyLast4: body?.apiKeyLast4 ?? null,
              clerkCodes: body?.clerkCodes ?? clerkCodes,
            });
          })
          .catch((err: unknown) => setError(err instanceof Error ? err.message : '코드를 연결하지 못했습니다.'))
          .finally(() => setBusy(false));
      }}
    >
      <label className="block">
        <span className="text-fluid-2xs text-slate-500">MID</span>
        <input className={INPUT} value={mid} onChange={(e) => setMid(e.target.value)} autoComplete="off" />
      </label>
      <label className="block">
        <span className="text-fluid-2xs text-slate-500">OID (4자리)</span>
        <input className={INPUT} value={oid} onChange={(e) => setOid(e.target.value)} autoComplete="off" maxLength={8} />
      </label>
      <label className="block sm:col-span-2">
        <span className="text-fluid-2xs text-slate-500">API 키 또는 결제창 mKey</span>
        <input className={INPUT} value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
      </label>
      <label className="block sm:col-span-2">
        <span className="text-fluid-2xs text-slate-500">TID (비우면 MID와 같게 저장)</span>
        <input className={INPUT} value={tid} onChange={(e) => setTid(e.target.value)} autoComplete="off" />
      </label>
      <div className="sm:col-span-2">
        <p className="text-fluid-2xs text-slate-500">고유번호 코드 15개. 전자계약이 들어온 뒤에 여기에 넣습니다.</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {clerkCodes.map((code, index) => (
            <label key={index} className="block">
              <span className="text-fluid-2xs text-slate-500">{index + 1}번</span>
              <input
                className={INPUT}
                value={code}
                autoComplete="off"
                maxLength={32}
                onChange={(e) => {
                  const value = e.target.value;
                  setClerkCodes((prev) => prev.map((item, itemIndex) => (itemIndex === index ? value : item)));
                }}
              />
            </label>
          ))}
        </div>
      </div>
      <p className="text-fluid-2xs text-slate-500 sm:col-span-2">수기 키는 ssp-로 시작합니다. 결제창 키는 mKey입니다. 카드번호는 적지 않습니다.</p>
      {done ? <p className="text-fluid-xs font-medium text-emerald-800 sm:col-span-2">{done}</p> : null}
      {error ? <p className="text-fluid-xs text-red-700 sm:col-span-2">{error}</p> : null}
      <button type="submit" className={`${BTN} sm:col-span-2`} disabled={busy || !apiKey.trim() || clerkCodes.some((code) => !code.trim())}>
        {busy ? '연결 중' : '이 업체에 연결'}
      </button>
    </form>
  );
}
