import { useEffect, useState } from 'react';
import { TENANT_PG_ONBOARDING_STATUS_LABEL, type TenantPgOnboardingStatus } from '@shared/cardPayment';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';

const TOKEN_KEY = 'cbiseo.pgPartnerToken';

type Application = {
  id: string;
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
  status: string;
  submittedAt: string | null;
  connected: boolean;
  mid: string | null;
  oid: string | null;
  apiKeyLast4: string | null;
};

const INPUT =
  'login-field-input mt-1 w-full min-h-11 rounded-lg border border-slate-200 px-3 text-fluid-sm';
const BTN =
  'min-h-11 rounded-xl bg-slate-900 px-4 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function line(label: string, value: string | null) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-900">{value}</span>
    </div>
  );
}

function statusLabel(status: string): string {
  return TENANT_PG_ONBOARDING_STATUS_LABEL[status as TenantPgOnboardingStatus] ?? status;
}

function ApplicationCard({
  row,
  token,
  onSaved,
}: {
  row: Application;
  token: string;
  onSaved: (id: string, next: { mid: string | null; oid: string | null; apiKeyLast4: string | null }) => void;
}) {
  const [mid, setMid] = useState(row.mid ?? '');
  const [oid, setOid] = useState(row.oid ?? '');
  const [apiKey, setApiKey] = useState('');
  const [tid, setTid] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-fluid-sm font-semibold text-slate-900">{row.businessName || row.tenantName}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-fluid-2xs text-slate-700">{statusLabel(row.status)}</span>
      </div>
      <div className="mt-3 space-y-1 text-fluid-xs">
        {line('업체', row.tenantName)}
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
      </div>
      {row.businessRegistrationImageUrl ? (
        <a href={row.businessRegistrationImageUrl} target="_blank" rel="noreferrer" className="mt-3 block">
          <span className="text-fluid-2xs text-slate-500">사업자등록증</span>
          <img
            src={row.businessRegistrationImageUrl}
            alt="사업자등록증"
            className="mt-1 max-h-56 w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
          />
        </a>
      ) : (
        <p className="mt-3 text-fluid-2xs text-amber-800">사업자등록증 없음</p>
      )}
      {row.connected ? (
        <p className="mt-3 text-fluid-xs text-emerald-800">
          연결됨 {row.mid ? `MID ${row.mid}` : ''} {row.oid ? `OID ${row.oid}` : ''}
          {row.apiKeyLast4 ? ` · 키 …${row.apiKeyLast4}` : ''}
        </p>
      ) : null}
      {done ? <p className="mt-2 text-fluid-xs font-medium text-emerald-800">{done}</p> : null}
      {error ? <p className="mt-2 text-fluid-xs text-red-700">{error}</p> : null}
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          void fetch(`/api/public/card-payment/pg-partner/applications/${encodeURIComponent(row.id)}/codes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ mid, oid, apiKey, tid }),
          })
            .then(async (res) => {
              const body = (await res.json().catch(() => null)) as {
                error?: string;
                mid?: string | null;
                oid?: string | null;
                apiKeyLast4?: string | null;
              } | null;
              if (res.status === 401) throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
              if (!res.ok) throw new Error(body?.error || '코드를 연결하지 못했습니다.');
              setApiKey('');
              setDone('이 업체에 연결했습니다.');
              onSaved(row.id, { mid: body?.mid ?? mid, oid: body?.oid ?? oid, apiKeyLast4: body?.apiKeyLast4 ?? null });
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
        <p className="sm:col-span-2 text-fluid-2xs text-slate-500">수기 키는 ssp-로 시작합니다. 결제창 키는 mKey입니다. 카드번호는 적지 않습니다.</p>
        <button type="submit" className={`${BTN} sm:col-span-2`} disabled={busy || !apiKey.trim()}>
          {busy ? '연결 중' : '이 업체에 연결'}
        </button>
      </form>
    </article>
  );
}

export function PgPartnerPage() {
  const { scrollRef, onFieldFocus } = useLoginScrollSurface(true);
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) ?? '');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Application[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetch('/api/public/card-payment/pg-partner/applications', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setToken('');
          throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
        }
        if (!res.ok) throw new Error('신청 내역을 불러오지 못했습니다.');
        return res.json() as Promise<{ items: Application[] }>;
      })
      .then((data) => setItems(data.items))
      .catch((e: unknown) => setListError(e instanceof Error ? e.message : '신청 내역을 불러오지 못했습니다.'));
  }, [token]);

  return (
    <div ref={scrollRef} onFocusCapture={onFieldFocus} className="login-surface min-h-dvh overflow-y-auto bg-slate-100">
      <div className="login-scroll-content mx-auto w-full max-w-3xl px-4 py-8">
        {!token ? (
          <form
            className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg"
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
                  sessionStorage.setItem(TOKEN_KEY, body.token);
                  setToken(body.token);
                  setPassword('');
                })
                .catch((err: unknown) => setLoginError(err instanceof Error ? err.message : '로그인하지 못했습니다.'))
                .finally(() => setBusy(false));
            }}
          >
            <h1 className="text-fluid-base font-semibold text-slate-900">원성페이먼츠 PG</h1>
            <p className="mt-1 text-fluid-xs text-slate-600">로그인하면 PG 신청 내역을 보고, 업체마다 가맹 코드를 입력할 수 있습니다.</p>
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
            <button type="submit" className={`${BTN} mt-4 w-full`} disabled={busy || !loginId.trim() || !password}>
              {busy ? '확인 중' : '로그인'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-fluid-base font-semibold text-slate-900">PG 신청 내역</h1>
                <p className="mt-1 text-fluid-xs text-slate-600">업체를 확인한 뒤 MID, OID, 키를 입력하면 그 업체에 바로 연결됩니다.</p>
              </div>
              <button
                type="button"
                className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                onClick={() => {
                  sessionStorage.removeItem(TOKEN_KEY);
                  setToken('');
                  setItems(null);
                }}
              >
                로그아웃
              </button>
            </div>
            {listError ? <p className="text-fluid-sm text-red-700">{listError}</p> : null}
            {!items && !listError ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}
            {items && items.length === 0 ? <p className="text-fluid-sm text-slate-500">접수된 PG 신청이 없습니다.</p> : null}
            {items?.map((row) => (
              <ApplicationCard
                key={row.id}
                row={row}
                token={token}
                onSaved={(id, next) => {
                  setItems((prev) =>
                    prev?.map((item) =>
                      item.id === id ? { ...item, connected: true, mid: next.mid, oid: next.oid, apiKeyLast4: next.apiKeyLast4, status: 'APPROVED' } : item,
                    ) ?? null,
                  );
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
