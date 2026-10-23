import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearPgPartnerToken, readPgPartnerToken } from './pgPartnerSession';
import { PgPartnerNotifyEmails } from './PgPartnerNotifyEmails';
import { PgPartnerTabs, usePartnerTab } from './PgPartnerTabs';

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
  merchantKind: string | null;
  bankbookImageUrl: string | null;
  idCardImageUrl: string | null;
  status: string;
  submittedAt: string | null;
  contractSignedAt: string | null;
  connected: boolean;
  merchantDeleted?: boolean;
  mid: string | null;
  oid: string | null;
  apiKeyLast4: string | null;
  clerkCodes: string[];
};

const BTN =
  'min-h-11 rounded-xl bg-slate-900 px-4 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
const BTN_REJECT =
  'min-h-11 rounded-xl border border-red-200 bg-white px-4 text-fluid-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function stageLabel(row: { status: string; contractSignedAt: string | null; connected: boolean; merchantDeleted?: boolean }) {
  if (row.merchantDeleted) return '삭제됨';
  if (row.connected) return '연결됨';
  if (row.status === 'REJECTED') return '거절';
  if (row.status === 'APPROVED' && row.contractSignedAt) return '코드 대기';
  if (row.status === 'APPROVED') return '승인 · 계약 전';
  return '심사 대기';
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

function ApplicationCard({
  row,
  onDecided,
}: {
  row: Application;
  onDecided: (id: string, status: string) => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const locked = Boolean(row.merchantDeleted);
  const waiting = !locked && !row.connected && (row.status === 'SUBMITTED' || row.status === 'FORWARDED_TO_PG');
  const canUndoReject = !locked && !row.connected && !row.contractSignedAt && row.status === 'REJECTED';
  const canUndoApprove = !locked && !row.connected && !row.contractSignedAt && row.status === 'APPROVED';

  const decide = (decision: 'APPROVED' | 'REJECTED') => {
    setBusy(true);
    setError(null);
    void fetch(`/api/public/card-payment/pg-partner/applications/${encodeURIComponent(row.id)}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${readPgPartnerToken()}` },
      body: JSON.stringify({ decision }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { error?: string; status?: string } | null;
        if (res.status === 401) {
          clearPgPartnerToken();
          navigate('/pg-partner', { replace: true });
          return;
        }
        if (!res.ok) throw new Error(body?.error || '처리하지 못했습니다.');
        const status = body?.status ?? decision;
        setDone(status === 'APPROVED' ? '승인했습니다. 전자계약이 오면 코드를 입력합니다.' : '거절했습니다.');
        onDecided(row.id, status);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '처리하지 못했습니다.'))
      .finally(() => setBusy(false));
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-fluid-sm font-semibold text-slate-900">{row.businessName || row.tenantName}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-fluid-2xs text-slate-700">{stageLabel(row)}</span>
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
      {row.merchantKind === 'corp' ? (
        <p className="mt-3 text-fluid-2xs text-slate-700">법인 서류(사업자등록증, 통장사본, 법인인감, 법인등기부)는 우편으로 받습니다.</p>
      ) : null}
      {row.businessRegistrationImageUrl ? (
        <a href={row.businessRegistrationImageUrl} target="_blank" rel="noreferrer" className="mt-3 block">
          <span className="text-fluid-2xs text-slate-500">사업자등록증</span>
          <img
            src={row.businessRegistrationImageUrl}
            alt="사업자등록증"
            className="mt-1 max-h-56 w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
          />
        </a>
      ) : row.merchantKind === 'solo' ? (
        <p className="mt-3 text-fluid-2xs text-amber-800">사업자등록증 없음</p>
      ) : null}
      {row.bankbookImageUrl ? (
        <a href={row.bankbookImageUrl} target="_blank" rel="noreferrer" className="mt-3 block">
          <span className="text-fluid-2xs text-slate-500">통장사본</span>
          <img src={row.bankbookImageUrl} alt="통장사본" className="mt-1 max-h-56 w-full rounded-lg border border-slate-200 bg-slate-50 object-contain" />
        </a>
      ) : null}
      {row.idCardImageUrl ? (
        <a href={row.idCardImageUrl} target="_blank" rel="noreferrer" className="mt-3 block">
          <span className="text-fluid-2xs text-slate-500">신분증</span>
          <img src={row.idCardImageUrl} alt="신분증" className="mt-1 max-h-56 w-full rounded-lg border border-slate-200 bg-slate-50 object-contain" />
        </a>
      ) : null}
      {locked ? (
        <p className="mt-3 text-fluid-xs text-red-700">가맹 연결을 삭제했습니다. 지난 결제 수수료는 수수료 화면에서 볼 수 있습니다.</p>
      ) : row.connected ? (
        <p className="mt-3 text-fluid-xs text-emerald-800">
          연결됨 {row.mid ? `MID ${row.mid}` : ''} {row.oid ? `OID ${row.oid}` : ''}
          {row.apiKeyLast4 ? ` · 키 …${row.apiKeyLast4}` : ''}
        </p>
      ) : row.status === 'APPROVED' && row.contractSignedAt ? (
        <p className="mt-3 text-fluid-xs text-slate-700">전자계약이 들어왔습니다. 전자계약 탭에서 이 업체를 열고 코드를 입력합니다.</p>
      ) : row.status === 'APPROVED' ? (
        <p className="mt-3 text-fluid-xs text-slate-700">승인했습니다. 업체가 전자계약을 제출하면 코드를 입력할 수 있습니다.</p>
      ) : row.status === 'REJECTED' ? (
        <p className="mt-3 text-fluid-xs text-slate-700">거절했습니다. 업체가 다시 신청할 수 있습니다.</p>
      ) : (
        <p className="mt-3 text-fluid-xs text-slate-700">신청 내용만 확인하고 승인하거나 거절합니다. 코드는 전자계약 뒤에 입력합니다.</p>
      )}
      {done ? <p className="mt-2 text-fluid-xs font-medium text-emerald-800">{done}</p> : null}
      {error ? <p className="mt-2 text-fluid-xs text-red-700">{error}</p> : null}
      {waiting || canUndoApprove || canUndoReject ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {waiting || canUndoReject ? (
            <button type="button" className={BTN} disabled={busy} onClick={() => decide('APPROVED')}>
              {busy ? '처리 중' : '승인'}
            </button>
          ) : null}
          {waiting || canUndoApprove ? (
            <button type="button" className={BTN_REJECT} disabled={busy} onClick={() => decide('REJECTED')}>
              거절
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function PgPartnerApplicationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Application[] | null>(null);
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
            : '신청을 승인하거나 거절합니다. 코드는 전자계약이 들어온 뒤에 입력합니다.'}
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
      {tab === 'list'
        ? items?.map((row) => (
            <ApplicationCard
              key={row.id}
              row={row}
              onDecided={(id, status) => {
                setItems((prev) => prev?.map((item) => (item.id === id ? { ...item, status } : item)) ?? null);
              }}
            />
          ))
        : null}
    </div>
  );
}
