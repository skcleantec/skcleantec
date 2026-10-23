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
  merchantKind?: string | null;
  bankbookImageUrl?: string | null;
  idCardImageUrl?: string | null;
  status?: string;
  contractSignedAt?: string | null;
  connected: boolean;
  mid: string | null;
  oid: string | null;
  apiKeyLast4: string | null;
};

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

  useEffect(() => {
    void fetch(`/api/public/card-payment/pg-join/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('PG 신청을 찾을 수 없습니다.');
        return res.json() as Promise<Review>;
      })
      .then(setRow)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'));
  }, [token]);

  return (
    <div ref={scrollRef} onFocusCapture={onFieldFocus} className="login-surface min-h-dvh overflow-y-auto bg-slate-100">
      <div className="login-scroll-content mx-auto w-full max-w-lg px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
          <h1 className="text-fluid-base font-semibold text-slate-900">가맹 신청 확인</h1>
          <p className="mt-1 text-fluid-xs text-slate-600">신청을 승인한 뒤, 전자계약이 들어오면 원성 화면에서 코드를 입력합니다.</p>
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
                {row.merchantKind === 'corp' ? (
                  <p className="text-slate-700">법인 서류는 우편으로 받습니다.</p>
                ) : null}
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
                {row.bankbookImageUrl ? (
                  <a href={row.bankbookImageUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                    <span className="text-slate-500">통장사본</span>
                    <img src={row.bankbookImageUrl} alt="통장사본" className="mt-1 max-h-64 w-full rounded-lg border border-slate-200 bg-white object-contain" />
                  </a>
                ) : null}
                {row.idCardImageUrl ? (
                  <a href={row.idCardImageUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                    <span className="text-slate-500">신분증</span>
                    <img src={row.idCardImageUrl} alt="신분증" className="mt-1 max-h-64 w-full rounded-lg border border-slate-200 bg-white object-contain" />
                  </a>
                ) : null}
              </div>
              {row.connected ? (
                <p className="mt-3 text-fluid-xs text-emerald-800">
                  연결됨 {row.mid ? `MID ${row.mid}` : ''} {row.oid ? `OID ${row.oid}` : ''}
                  {row.apiKeyLast4 ? ` · 키 …${row.apiKeyLast4}` : ''}
                </p>
              ) : null}
              {row.connected ? null : row.status === 'APPROVED' && row.contractSignedAt ? (
                <p className="mt-3 text-fluid-xs text-slate-700">전자계약이 들어왔습니다. 원성 화면의 전자계약에서 이 업체를 열고 코드를 입력합니다.</p>
              ) : row.status === 'APPROVED' ? (
                <p className="mt-3 text-fluid-xs text-slate-700">승인된 신청입니다. 업체가 전자계약을 제출하면 코드를 입력합니다.</p>
              ) : row.status === 'REJECTED' ? (
                <p className="mt-3 text-fluid-xs text-slate-700">거절된 신청입니다.</p>
              ) : (
                <p className="mt-3 text-fluid-xs text-slate-700">심사 대기입니다. 승인이나 거절은 원성 화면의 PG 신청에서 합니다.</p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
