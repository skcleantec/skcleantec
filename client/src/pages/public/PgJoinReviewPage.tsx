import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';

type Review = {
  tenantName: string;
  businessName: string | null;
  bizNumber: string | null;
  representativeName: string | null;
  representativeBirth: string | null;
  addressLine: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  bankName: string | null;
  bankAccount: string | null;
  accountHolder: string | null;
  websiteUrl: string | null;
  note: string | null;
  businessRegistrationImageUrl: string | null;
  connected: boolean;
  mid: string | null;
  oid: string | null;
  apiKeyLast4: string | null;
};

const INPUT =
  'login-field-input mt-1 w-full min-h-11 rounded-lg border border-slate-200 px-3 text-fluid-sm';
const BTN =
  'min-h-11 w-full rounded-xl bg-slate-900 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function line(label: string, value: string | null) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-900">{value}</span>
    </div>
  );
}

export function PgJoinReviewPage() {
  const { token = '' } = useParams();
  const { scrollRef, onFieldFocus } = useLoginScrollSurface(true);
  const [row, setRow] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mid, setMid] = useState('');
  const [oid, setOid] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [tid, setTid] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/public/card-payment/pg-join/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('PG 신청을 찾을 수 없습니다.');
        return res.json() as Promise<Review>;
      })
      .then((data) => {
        setRow(data);
        setMid(data.mid ?? '');
        setOid(data.oid ?? '');
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'));
  }, [token]);

  return (
    <div ref={scrollRef} onFocusCapture={onFieldFocus} className="login-surface min-h-dvh overflow-y-auto bg-slate-100">
      <div className="login-scroll-content mx-auto w-full max-w-lg px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
          <h1 className="text-fluid-base font-semibold text-slate-900">가맹 코드 입력</h1>
          <p className="mt-1 text-fluid-xs text-slate-600">신청 업체를 확인한 뒤 MID, OID, 키를 입력하면 그 업체에 바로 연결됩니다.</p>
          {error ? <p className="mt-3 text-fluid-sm text-red-700">{error}</p> : null}
          {!row && !error ? <p className="mt-4 text-fluid-sm text-slate-500">불러오는 중…</p> : null}
          {row ? (
            <>
              <div className="mt-4 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-fluid-xs">
                <p className="font-medium text-slate-900">{row.businessName || row.tenantName}</p>
                {line('사업자번호', row.bizNumber)}
                {line('대표자', row.representativeName)}
                {line('생년월일', row.representativeBirth)}
                {line('주소', row.addressLine)}
                {line('담당자', row.contactName)}
                {line('전화', row.contactPhone)}
                {line('이메일', row.contactEmail)}
                {line('정산 계좌', [row.bankName, row.bankAccount, row.accountHolder].filter(Boolean).join(' ') || null)}
                {line('홈페이지', row.websiteUrl)}
                {line('메모', row.note)}
                {row.businessRegistrationImageUrl ? (
                  <a href={row.businessRegistrationImageUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                    <span className="text-slate-500">사업자등록증</span>
                    <img
                      src={row.businessRegistrationImageUrl}
                      alt="사업자등록증"
                      className="mt-1 max-h-64 w-full rounded-lg border border-slate-200 bg-white object-contain"
                    />
                  </a>
                ) : null}
              </div>
              {row.connected ? (
                <p className="mt-3 text-fluid-xs text-emerald-800">
                  연결됨 {row.mid ? `MID ${row.mid}` : ''} {row.oid ? `OID ${row.oid}` : ''}
                  {row.apiKeyLast4 ? ` · 키 …${row.apiKeyLast4}` : ''}
                </p>
              ) : null}
              {done ? <p className="mt-3 text-fluid-sm font-medium text-emerald-800">{done}</p> : null}
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError(null);
                  void fetch(`/api/public/card-payment/pg-join/${encodeURIComponent(token)}/codes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mid, oid, apiKey, tid }),
                  })
                    .then(async (res) => {
                      const body = (await res.json().catch(() => null)) as { error?: string } | null;
                      if (!res.ok) throw new Error(body?.error || '코드를 연결하지 못했습니다.');
                      setApiKey('');
                      setDone('이 업체에 연결했습니다.');
                      setRow({ ...row, connected: true, mid, oid });
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
                <label className="block">
                  <span className="text-fluid-2xs text-slate-500">API 키 또는 결제창 mKey</span>
                  <input className={INPUT} value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
                </label>
                <label className="block">
                  <span className="text-fluid-2xs text-slate-500">TID (비우면 MID와 같게 저장)</span>
                  <input className={INPUT} value={tid} onChange={(e) => setTid(e.target.value)} autoComplete="off" />
                </label>
                <p className="text-fluid-2xs text-slate-500">수기 키는 ssp-로 시작합니다. 결제창 키는 mKey입니다. 카드번호는 적지 않습니다.</p>
                <button type="submit" className={BTN} disabled={busy || !apiKey.trim()}>
                  {busy ? '연결 중' : '이 업체에 연결'}
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
