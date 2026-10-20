import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearPgPartnerToken, readPgPartnerToken } from './pgPartnerSession';
import { PgPartnerModal } from './PgPartnerModal';
import { maskKeptSecret, PgPartnerSecretValue } from './PgPartnerSecretValue';

type ListItem = {
  tenantId: string;
  tenantName: string;
  businessName: string | null;
  bizNumber: string | null;
  contactPhone: string | null;
  keyinMid: string | null;
  linkMid: string | null;
  role?: 'AGENCY' | 'MERCHANT';
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
  sellerPasswordSet: boolean;
  role?: 'AGENCY' | 'MERCHANT';
  keyin: Slot;
  link: Slot;
};

const INPUT = 'login-field-input mt-1 w-full min-h-11 rounded-lg border border-slate-200 px-3 text-fluid-sm';
const BTN =
  'min-h-11 rounded-xl bg-slate-900 px-4 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function authHeaders() {
  return { Authorization: `Bearer ${readPgPartnerToken()}` };
}

function RailEditor({
  title,
  slot,
  mid,
  oid,
  tid,
  apiKey,
  onMid,
  onOid,
  onTid,
  onApiKey,
  tenantId,
  rail,
}: {
  title: string;
  slot: Slot;
  mid: string;
  oid: string;
  tid: string;
  apiKey: string;
  onMid: (value: string) => void;
  onOid: (value: string) => void;
  onTid: (value: string) => void;
  onApiKey: (value: string) => void;
  tenantId: string;
  rail: 'KEYIN' | 'LINK';
}) {
  return (
    <section className="rounded-xl border border-slate-200 p-3">
      <h3 className="text-fluid-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">MID</span>
          <input className={INPUT} value={mid} onChange={(e) => onMid(e.target.value)} autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">주문번호 4자리</span>
          <input className={INPUT} value={oid} onChange={(e) => onOid(e.target.value)} autoComplete="off" maxLength={4} />
        </label>
        <PgPartnerSecretValue label="TID" masked={slot.connected ? maskKeptSecret(slot.tidMasked) : '없음'} tenantId={tenantId} rail={rail} field="tid" />
        <PgPartnerSecretValue label="API 키" masked={slot.connected ? maskKeptSecret(slot.apiKeyLast4) : '없음'} tenantId={tenantId} rail={rail} field="apiKey" />
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">TID 변경</span>
          <input className={INPUT} value={tid} onChange={(e) => onTid(e.target.value)} autoComplete="off" placeholder="바꿀 때만 입력" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">API 키 변경</span>
          <input className={INPUT} value={apiKey} onChange={(e) => onApiKey(e.target.value)} autoComplete="off" placeholder="바꿀 때만 입력" />
        </label>
      </div>
    </section>
  );
}

function MerchantModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sellerLoginId, setSellerLoginId] = useState('');
  const [sellerPassword, setSellerPassword] = useState('');
  const [keyinMid, setKeyinMid] = useState('');
  const [keyinOid, setKeyinOid] = useState('');
  const [keyinTid, setKeyinTid] = useState('');
  const [keyinKey, setKeyinKey] = useState('');
  const [linkMid, setLinkMid] = useState('');
  const [linkOid, setLinkOid] = useState('');
  const [linkTid, setLinkTid] = useState('');
  const [linkKey, setLinkKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
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
        setSellerPassword('');
        setKeyinMid(row.keyin.connected ? row.keyin.mid ?? '' : '');
        setKeyinOid(row.keyin.connected ? row.keyin.oid ?? '' : '');
        setLinkMid(row.link.connected ? row.link.mid ?? '' : '');
        setLinkOid(row.link.connected ? row.link.oid ?? '' : '');
        setKeyinTid('');
        setKeyinKey('');
        setLinkTid('');
        setLinkKey('');
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '업체 정보를 불러오지 못했습니다.'));
  }, [navigate, tenantId, reloadKey]);

  const saveRail = (rail: 'KEYIN' | 'LINK', mid: string, oid: string, tid: string, apiKey: string) =>
    fetch(`/api/public/card-payment/pg-partner/merchants/${encodeURIComponent(tenantId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ rail, mid, oid, tid, apiKey, sellerLoginId, sellerPassword }),
    }).then(async (res) => {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 401) {
        clearPgPartnerToken();
        navigate('/pg-partner', { replace: true });
        throw new Error('다시 로그인해 주세요.');
      }
      if (!res.ok) throw new Error(body?.error || '저장하지 못했습니다.');
    });

  const facts = detail
    ? [
        ['업체', detail.tenantName],
        ['상호', detail.businessName],
        ['사업자번호', detail.bizNumber],
        ['대표', detail.representativeName],
        ['전화', detail.contactPhone],
        ['이메일', detail.contactEmail],
      ].filter(([, value]) => value)
    : [];

  return (
    <PgPartnerModal title={detail?.businessName || detail?.tenantName || '사용 중 업체'} onClose={onClose}>
      {error ? <p className="text-fluid-sm text-red-700">{error}</p> : null}
      {!detail && !error ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {detail ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            setDone(null);
            const jobs: Promise<void>[] = [];
            if (detail.keyin.connected || keyinKey.trim()) jobs.push(saveRail('KEYIN', keyinMid, keyinOid, keyinTid, keyinKey));
            if (detail.link.connected || linkKey.trim()) jobs.push(saveRail('LINK', linkMid, linkOid, linkTid, linkKey));
            if (jobs.length === 0 && detail.role === 'AGENCY') {
              jobs.push(saveRail('KEYIN', keyinMid, keyinOid, '', ''));
            }
            if (jobs.length === 0) {
              setError('수기 또는 인증 API 키를 입력해 주세요.');
              setBusy(false);
              return;
            }
            void Promise.all(jobs)
              .then(() => {
                setDone(detail.role === 'AGENCY' ? '저장했습니다. 이용료 카드결재에 반영됩니다.' : '저장했습니다. 팀장 카드결재에 바로 반영됩니다.');
                setReloadKey((n) => n + 1);
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : '저장하지 못했습니다.'))
              .finally(() => setBusy(false));
          }}
        >
          <dl className="grid gap-2 sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-fluid-2xs text-slate-500">{label}</dt>
                <dd className="truncate text-fluid-xs text-slate-900" title={value ?? ''}>{value}</dd>
              </div>
            ))}
          </dl>
          <section className="rounded-xl border border-slate-200 p-3">
            <h3 className="text-fluid-sm font-semibold text-slate-900">판매자센터</h3>
            <p className="mt-1 text-fluid-2xs text-slate-500">수기와 인증이 같은 판매자센터를 씁니다. https://wspay.net</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-fluid-2xs text-slate-500">아이디</span>
                <input className={INPUT} value={sellerLoginId} onChange={(e) => setSellerLoginId(e.target.value)} autoComplete="off" />
              </label>
              <PgPartnerSecretValue
                label="비밀번호"
                masked={detail.sellerPasswordSet ? '••••••••' : '없음'}
                tenantId={tenantId}
                rail="KEYIN"
                field="sellerPassword"
              />
              <label className="block">
                <span className="text-fluid-2xs text-slate-500">비밀번호 변경</span>
                <input className={INPUT} type="password" value={sellerPassword} onChange={(e) => setSellerPassword(e.target.value)} autoComplete="new-password" placeholder="바꿀 때만 입력" />
              </label>
            </div>
          </section>
          <div className="grid gap-3 lg:grid-cols-2">
            <RailEditor title="수기" slot={detail.keyin} mid={keyinMid} oid={keyinOid} tid={keyinTid} apiKey={keyinKey} onMid={setKeyinMid} onOid={setKeyinOid} onTid={setKeyinTid} onApiKey={setKeyinKey} tenantId={tenantId} rail="KEYIN" />
            <RailEditor title="인증" slot={detail.link} mid={linkMid} oid={linkOid} tid={linkTid} apiKey={linkKey} onMid={setLinkMid} onOid={setLinkOid} onTid={setLinkTid} onApiKey={setLinkKey} tenantId={tenantId} rail="LINK" />
          </div>
          {done ? <p className="text-fluid-xs font-medium text-emerald-800">{done}</p> : null}
          <button type="submit" className={BTN} disabled={busy}>
            {busy ? '저장 중' : '저장'}
          </button>
        </form>
      ) : null}
    </PgPartnerModal>
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
        <p className="mt-1 text-fluid-xs text-slate-600">업체를 누르면 판매자센터와 수기·인증 정보를 고칠 수 있습니다. 서비스브릿지 대리점은 이용료 가맹이라 여기서 고친 코드가 이용료 결재에 쓰입니다. TID와 API 키는 가려 두고, 보기를 누른 뒤 비밀번호로 확인합니다.</p>
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
                      {row.role === 'AGENCY' ? <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-fluid-2xs font-medium text-slate-600">대리점</span> : null}
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
      {selectedId ? <MerchantModal tenantId={selectedId} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}
