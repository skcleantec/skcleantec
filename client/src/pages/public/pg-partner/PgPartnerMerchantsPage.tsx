import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearPgPartnerToken, readPgPartnerToken } from './pgPartnerSession';

type ListItem = {
  tenantId: string;
  tenantName: string;
  businessName: string | null;
  bizNumber: string | null;
  contactPhone: string | null;
  keyinMid: string | null;
  linkMid: string | null;
};

type Slot =
  | { connected: false }
  | { connected: true; isActive: boolean; mid: string | null; oid: string | null; tidMasked: string | null; apiKeyLast4: string | null };

type Detail = {
  tenantId: string;
  tenantName: string;
  businessName: string | null;
  bizNumber: string | null;
  representativeName: string | null;
  addressLine: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  bankName: string | null;
  bankAccount: string | null;
  accountHolder: string | null;
  sellerLoginId: string;
  sellerPassword: string;
  keyin: Slot;
  link: Slot;
};

const INPUT = 'login-field-input mt-1 w-full min-h-11 rounded-lg border border-slate-200 px-3 text-fluid-sm';
const BTN =
  'min-h-11 rounded-xl bg-slate-900 px-4 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function authHeaders() {
  return { Authorization: `Bearer ${readPgPartnerToken()}` };
}

function RailForm({
  tenantId,
  rail,
  title,
  slot,
  sellerLoginId,
  sellerPassword,
  onSellerLoginId,
  onSellerPassword,
  onSaved,
}: {
  tenantId: string;
  rail: 'KEYIN' | 'LINK';
  title: string;
  slot: Slot;
  sellerLoginId: string;
  sellerPassword: string;
  onSellerLoginId: (value: string) => void;
  onSellerPassword: (value: string) => void;
  onSaved: () => void;
}) {
  const navigate = useNavigate();
  const [mid, setMid] = useState(slot.connected ? slot.mid ?? '' : '');
  const [oid, setOid] = useState(slot.connected ? slot.oid ?? '' : '');
  const [tid, setTid] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const needsKey = !slot.connected;

  return (
    <form
      className="rounded-2xl border border-slate-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setDone(null);
        void fetch(`/api/public/card-payment/pg-partner/merchants/${encodeURIComponent(tenantId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ rail, mid, oid, tid, apiKey, sellerLoginId, sellerPassword }),
        })
          .then(async (res) => {
            const body = (await res.json().catch(() => null)) as { error?: string } | null;
            if (res.status === 401) {
              clearPgPartnerToken();
              navigate('/pg-partner', { replace: true });
              return;
            }
            if (!res.ok) throw new Error(body?.error || '저장하지 못했습니다.');
            setApiKey('');
            setTid('');
            setDone('저장했습니다. 이 업체는 계속 사용 중입니다.');
            onSaved();
          })
          .catch((err: unknown) => setError(err instanceof Error ? err.message : '저장하지 못했습니다.'))
          .finally(() => setBusy(false));
      }}
    >
      <h3 className="text-fluid-sm font-semibold text-slate-900">{title}</h3>
      {slot.connected ? (
        <p className="mt-1 text-fluid-2xs text-slate-500">
          현재 MID {slot.mid || '—'} · OID {slot.oid || '—'} · TID {slot.tidMasked || '—'} · 키 …{slot.apiKeyLast4 || '—'}
        </p>
      ) : (
        <p className="mt-1 text-fluid-2xs text-slate-500">아직 연결되지 않았습니다. 키를 넣으면 활성화됩니다.</p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">MID</span>
          <input className={INPUT} value={mid} onChange={(e) => setMid(e.target.value)} autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">OID (4자리)</span>
          <input className={INPUT} value={oid} onChange={(e) => setOid(e.target.value)} autoComplete="off" maxLength={8} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-fluid-2xs text-slate-500">TID {slot.connected ? '(비우면 기존 값 유지)' : ''}</span>
          <input className={INPUT} value={tid} onChange={(e) => setTid(e.target.value)} autoComplete="off" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-fluid-2xs text-slate-500">API 키 {slot.connected ? '(비우면 기존 키 유지)' : ''}</span>
          <input className={INPUT} value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">판매자센터 아이디</span>
          <input className={INPUT} value={sellerLoginId} onChange={(e) => onSellerLoginId(e.target.value)} autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">판매자센터 비밀번호 (비우면 유지)</span>
          <input className={INPUT} value={sellerPassword} onChange={(e) => onSellerPassword(e.target.value)} autoComplete="off" />
        </label>
      </div>
      {done ? <p className="mt-2 text-fluid-xs font-medium text-emerald-800">{done}</p> : null}
      {error ? <p className="mt-2 text-fluid-xs text-red-700">{error}</p> : null}
      <button type="submit" className={`${BTN} mt-3`} disabled={busy || (needsKey && !apiKey.trim())}>
        {busy ? '저장 중' : '저장'}
      </button>
    </form>
  );
}

function MerchantDetail({ tenantId }: { tenantId: string }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sellerLoginId, setSellerLoginId] = useState('');
  const [sellerPassword, setSellerPassword] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setDetail(null);
    void fetch(`/api/public/card-payment/pg-partner/merchants/${encodeURIComponent(tenantId)}`, { headers: authHeaders() })
      .then(async (res) => {
        if (res.status === 401) {
          clearPgPartnerToken();
          navigate('/pg-partner', { replace: true });
          return null;
        }
        if (!res.ok) throw new Error('업체 정보를 불러오지 못했습니다.');
        return res.json() as Promise<Detail>;
      })
      .then((row) => {
        if (!row) return;
        setDetail(row);
        setSellerLoginId(row.sellerLoginId || '');
        setSellerPassword(row.sellerPassword || '');
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '업체 정보를 불러오지 못했습니다.'));
  }, [navigate, tenantId, reloadKey]);

  if (error) return <p className="text-fluid-sm text-red-700">{error}</p>;
  if (!detail) return <p className="text-fluid-sm text-slate-500">불러오는 중…</p>;

  const facts = [
    ['업체', detail.tenantName],
    ['상호', detail.businessName],
    ['사업자번호', detail.bizNumber],
    ['대표', detail.representativeName],
    ['주소', detail.addressLine],
    ['담당', detail.contactName],
    ['전화', detail.contactPhone],
    ['이메일', detail.contactEmail],
    ['정산 계좌', [detail.bankName, detail.bankAccount, detail.accountHolder].filter(Boolean).join(' ')],
  ].filter(([, value]) => value);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-fluid-sm font-semibold text-slate-900">{detail.businessName || detail.tenantName}</h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-fluid-2xs text-slate-500">{label}</dt>
              <dd className="truncate text-fluid-xs text-slate-900" title={value ?? ''}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <RailForm
          tenantId={tenantId}
          rail="KEYIN"
          title="수기"
          slot={detail.keyin}
          sellerLoginId={sellerLoginId}
          sellerPassword={sellerPassword}
          onSellerLoginId={setSellerLoginId}
          onSellerPassword={setSellerPassword}
          onSaved={() => setReloadKey((n) => n + 1)}
        />
        <RailForm
          tenantId={tenantId}
          rail="LINK"
          title="인증"
          slot={detail.link}
          sellerLoginId={sellerLoginId}
          sellerPassword={sellerPassword}
          onSellerLoginId={setSellerLoginId}
          onSellerPassword={setSellerPassword}
          onSaved={() => setReloadKey((n) => n + 1)}
        />
      </div>
    </div>
  );
}

export function PgPartnerMerchantsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/public/card-payment/pg-partner/merchants', { headers: authHeaders() })
      .then(async (res) => {
        if (res.status === 401) {
          clearPgPartnerToken();
          navigate('/pg-partner', { replace: true });
          return null;
        }
        if (!res.ok) throw new Error('사용 중 업체를 불러오지 못했습니다.');
        return res.json() as Promise<{ items: ListItem[] }>;
      })
      .then((data) => {
        if (data) setItems(data.items);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '사용 중 업체를 불러오지 못했습니다.'));
  }, [navigate]);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-fluid-base font-semibold text-slate-900">사용 중 업체</h1>
        <p className="mt-1 text-fluid-xs text-slate-600">업체를 누르면 MID, OID, TID, API 키, 판매자센터 로그인을 고칠 수 있습니다. 키를 비우면 기존 키가 유지됩니다.</p>
      </div>
      {error ? <p className="text-fluid-sm text-red-700">{error}</p> : null}
      {!items && !error ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {items && items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-fluid-sm text-slate-500">사용 중인 업체가 없습니다.</p>
      ) : null}
      {items && items.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] border-collapse text-fluid-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {['업체', '사업자번호', '전화', '수기 MID', '인증 MID'].map((label) => (
                  <th key={label} className="px-3 py-2 text-center font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.tenantId} className={selectedId === row.tenantId ? 'bg-slate-100' : 'hover:bg-slate-50'}>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.tenantId)}
                      className="font-medium text-slate-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    >
                      {row.businessName || row.tenantName}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">{row.bizNumber || '—'}</td>
                  <td className="px-3 py-2 text-center">{row.contactPhone || '—'}</td>
                  <td className="px-3 py-2 text-center">{row.keyinMid || '—'}</td>
                  <td className="px-3 py-2 text-center">{row.linkMid || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {selectedId ? <MerchantDetail key={selectedId} tenantId={selectedId} /> : null}
    </div>
  );
}
