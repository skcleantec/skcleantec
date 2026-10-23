import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TENANT_PG_ONBOARDING_STATUS_LABEL, type TenantPgOnboardingStatus } from '@shared/cardPayment';
import { PgPartnerModal } from './PgPartnerModal';
import { PgPartnerNotifyEmails } from './PgPartnerNotifyEmails';
import { PgPartnerTabs, usePartnerTab } from './PgPartnerTabs';
import { clearPgPartnerToken, readPgPartnerToken } from './pgPartnerSession';

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
  businessKind: string | null;
  businessRegistrationImageUrl: string | null;
  businessCardImageUrl: string | null;
  consentTermsAt: string | null;
  consentPrivacyAt: string | null;
  consentThirdPartyAt: string | null;
  consentIllegalUseAt: string | null;
  consentMarketingAt: string | null;
  status: string;
  submittedAt: string | null;
  connected: boolean;
  mid: string | null;
  oid: string | null;
  apiKeyLast4: string | null;
};

const INPUT = 'login-field-input mt-1 w-full min-h-11 rounded-lg border border-slate-200 px-3 text-fluid-sm';
const BTN =
  'min-h-11 rounded-xl bg-slate-900 px-4 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function DocLink({ label, url }: { label: string; url: string | null }) {
  if (!url) return <p className="text-fluid-2xs text-amber-800">{label} 없음</p>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-200 p-2 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
      <span className="text-fluid-2xs text-slate-500">{label}</span>
      <img src={url} alt={label} className="mt-1 max-h-32 w-full rounded object-contain" />
    </a>
  );
}

function line(label: string, value: string | null) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="min-w-0 text-right text-slate-900">{value}</span>
    </div>
  );
}

function RailFields({
  title,
  hint,
  mid,
  oid,
  tid,
  apiKey,
  onMid,
  onOid,
  onTid,
  onApiKey,
}: {
  title: string;
  hint: string;
  mid: string;
  oid: string;
  tid: string;
  apiKey: string;
  onMid: (value: string) => void;
  onOid: (value: string) => void;
  onTid: (value: string) => void;
  onApiKey: (value: string) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 p-3">
      <h3 className="text-fluid-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-fluid-2xs text-slate-500">{hint}</p>
      <div className="mt-3 grid gap-3">
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">MID</span>
          <input className={INPUT} value={mid} onChange={(e) => onMid(e.target.value)} autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">주문번호 4자리</span>
          <input className={INPUT} value={oid} onChange={(e) => onOid(e.target.value.toUpperCase())} autoComplete="off" maxLength={4} />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">TID</span>
          <input className={INPUT} value={tid} onChange={(e) => onTid(e.target.value)} autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">API 키</span>
          <input className={INPUT} value={apiKey} onChange={(e) => onApiKey(e.target.value)} autoComplete="off" />
        </label>
      </div>
    </section>
  );
}

function ApplicationCard({
  row,
  onSaved,
  onClose,
}: {
  row: Application;
  onSaved: (id: string) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
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
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const ready = [sellerLoginId, sellerPassword, keyinMid, keyinOid, keyinTid, keyinKey, linkMid, linkOid, linkTid, linkKey].every((value) => value.trim());

  return (
    <PgPartnerModal title={row.businessName || row.tenantName} onClose={onClose}>
      <div className="space-y-1 text-fluid-xs">
        {line('사업자 구분', row.businessKind === 'CORPORATE' ? '법인 사업자' : row.businessKind === 'SOLE_PROPRIETOR' ? '개인 사업자' : '미선택')}
        {line('상태', TENANT_PG_ONBOARDING_STATUS_LABEL[row.status as TenantPgOnboardingStatus] ?? row.status)}
        {line('업체', row.tenantName)}
        {line('사업자번호', row.bizNumber)}
        {line('대표자', row.representativeName)}
        {line('전화', row.contactPhone)}
        {line('이메일', row.contactEmail)}
        {line('주소', row.addressLine)}
        {line('정산', [row.bankName, row.bankAccount, row.accountHolder].filter(Boolean).join(' ') || null)}
        {line('신청 서비스', '수기결제, 인증결제')}
        {line('요청', row.note)}
        {line('필수 동의', row.consentTermsAt && row.consentPrivacyAt && row.consentThirdPartyAt && row.consentIllegalUseAt ? '동의함' : '빠짐')}
        {line('마케팅 동의', row.consentMarketingAt ? '동의함' : '아니오')}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <DocLink label="사업자등록증" url={row.businessRegistrationImageUrl} />
        <DocLink label="명함" url={row.businessCardImageUrl} />
      </div>
      <p className="mt-2 text-fluid-2xs leading-snug text-slate-500">서류나 업체가 의심되면 연동하지 말고 반려하면 됩니다. 가맹 서비스는 수기결제와 인증결제입니다.</p>
      {error ? <p className="mt-2 text-fluid-xs text-red-700">{error}</p> : null}
      {done ? <p className="mt-2 text-fluid-xs font-medium text-emerald-800">{done}</p> : null}
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          void fetch(`/api/public/card-payment/pg-partner/applications/${encodeURIComponent(row.id)}/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${readPgPartnerToken()}` },
            body: JSON.stringify({
              sellerLoginId,
              sellerPassword,
              keyin: { mid: keyinMid, oid: keyinOid, tid: keyinTid, apiKey: keyinKey },
              link: { mid: linkMid, oid: linkOid, tid: linkTid, apiKey: linkKey },
            }),
          })
            .then(async (res) => {
              const body = (await res.json().catch(() => null)) as { error?: string } | null;
              if (res.status === 401) {
                clearPgPartnerToken();
                navigate('/pg-partner', { replace: true });
                return;
              }
              if (!res.ok) throw new Error(body?.error || '연동하지 못했습니다.');
              setDone('연동했습니다. 이 업체 팀장이 카드결재를 쓸 수 있습니다.');
              onSaved(row.id);
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : '연동하지 못했습니다.'))
            .finally(() => setBusy(false));
        }}
      >
        <section className="rounded-xl border border-slate-200 p-3">
          <h3 className="text-fluid-sm font-semibold text-slate-900">판매자센터</h3>
          <p className="mt-1 text-fluid-2xs text-slate-500">수기와 인증이 같은 아이디를 씁니다. https://wspay.net</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-fluid-2xs text-slate-500">아이디</span>
              <input className={INPUT} value={sellerLoginId} onChange={(e) => setSellerLoginId(e.target.value)} autoComplete="off" />
            </label>
            <label className="block">
              <span className="text-fluid-2xs text-slate-500">비밀번호</span>
              <input className={INPUT} type="password" value={sellerPassword} onChange={(e) => setSellerPassword(e.target.value)} autoComplete="new-password" />
            </label>
          </div>
        </section>
        <div className="grid gap-3 lg:grid-cols-2">
          <RailFields title="수기" hint="API 키는 ssp-로 시작합니다." mid={keyinMid} oid={keyinOid} tid={keyinTid} apiKey={keyinKey} onMid={setKeyinMid} onOid={setKeyinOid} onTid={setKeyinTid} onApiKey={setKeyinKey} />
          <RailFields title="인증" hint="API 키는 결제창 mKey입니다." mid={linkMid} oid={linkOid} tid={linkTid} apiKey={linkKey} onMid={setLinkMid} onOid={setLinkOid} onTid={setLinkTid} onApiKey={setLinkKey} />
        </div>
        <button type="submit" className={BTN} disabled={busy || !ready}>
          {busy ? '연동 중' : '연동하기'}
        </button>
      </form>
    </PgPartnerModal>
  );
}

export function PgPartnerApplicationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Application[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = usePartnerTab(['list', 'mail'] as const, 'list');

  useEffect(() => {
    void fetch('/api/public/card-payment/pg-partner/applications', {
      headers: { Authorization: `Bearer ${readPgPartnerToken()}` },
    })
      .then(async (res) => {
        if (res.status === 401) {
          clearPgPartnerToken();
          navigate('/pg-partner', { replace: true });
          return null;
        }
        if (!res.ok) throw new Error('신청 내역을 불러오지 못했습니다.');
        return res.json() as Promise<{ items: Application[] }>;
      })
      .then((data) => {
        if (data) setItems(data.items);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '신청 내역을 불러오지 못했습니다.'));
  }, [navigate]);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-fluid-base font-semibold text-slate-900">PG 신청</h1>
        <p className="mt-1 text-fluid-xs text-slate-600">
          {tab === 'mail'
            ? 'PG 신청과 전자계약이 끝나면 이 주소로 메일이 갑니다.'
            : '업체를 누르면 수기와 인증 정보를 넣고 연동할 수 있습니다. 연동하면 그 업체 팀장이 카드결재를 쓸 수 있습니다.'}
        </p>
      </div>
      <PgPartnerTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'list', label: '신청' },
          { id: 'mail', label: '알림 메일' },
        ]}
      />
      {tab === 'mail' ? <PgPartnerNotifyEmails /> : null}
      {tab === 'list' && error ? <p className="text-fluid-sm text-red-700">{error}</p> : null}
      {tab === 'list' && !items && !error ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {tab === 'list' && items && items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-fluid-sm text-slate-500">접수된 PG 신청이 없습니다.</p>
      ) : null}
      {tab === 'list' && items && items.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] border-collapse text-fluid-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {['업체', '상태', '담당', '전화', '연결'].map((label) => (
                  <th key={label} className="px-3 py-2 text-center font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  className={selectedId === row.id ? 'bg-slate-100' : 'hover:bg-slate-50'}
                >
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className="font-medium text-slate-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    >
                      {row.businessName || row.tenantName}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">{TENANT_PG_ONBOARDING_STATUS_LABEL[row.status as TenantPgOnboardingStatus] ?? row.status}</td>
                  <td className="px-3 py-2 text-center">{row.contactName || '—'}</td>
                  <td className="px-3 py-2 text-center">{row.contactPhone || '—'}</td>
                  <td className="px-3 py-2 text-center">{row.connected ? '연결됨' : '대기'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {tab === 'list'
        ? items?.filter((row) => row.id === selectedId).map((row) => (
        <ApplicationCard
          key={row.id}
          row={row}
          onClose={() => setSelectedId(null)}
          onSaved={(id) => {
            setItems((prev) => prev?.map((item) => (item.id === id ? { ...item, connected: true, status: 'APPROVED' } : item)) ?? null);
          }}
        />
      ))
        : null}
    </div>
  );
}
