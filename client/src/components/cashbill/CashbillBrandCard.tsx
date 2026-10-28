import { useState } from 'react';
import { BAROBILL_MEMBER_STATUS_LABEL, barobillTaxTypeLabel } from '@shared/barobillPolicy';
import { formatBizNumberDisplay, isValidKoreanBizNumberChecksum } from '@shared/authSignup';
import type { CashbillSettings } from '../../api/cashbill';
import { registerCashbillMember, uploadCashbillRegistration } from '../../api/cashbill';
import { CashbillCertRegisterModal } from './CashbillCertRegisterModal';

const INPUT =
  'mt-1 block w-full min-h-9 rounded-lg border border-gray-200 px-3 py-2 text-fluid-xs text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const BTN =
  'min-h-10 rounded-lg bg-slate-900 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none lg:min-h-[44px] lg:text-fluid-sm';

const BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-800',
  LINK_REQUIRED: 'bg-amber-50 text-amber-800',
  FAILED: 'bg-red-50 text-red-700',
  PENDING_REVIEW: 'bg-amber-50 text-amber-900',
  REJECTED: 'bg-red-50 text-red-800',
  PROCESSING: 'bg-slate-100 text-slate-700',
};

type Brand = CashbillSettings['brands'][number];

export function CashbillBrandCard({
  brand,
  prefill,
  canRegister,
  onDone,
}: {
  brand: Brand;
  prefill: CashbillSettings['prefill'];
  canRegister: boolean;
  onDone: (message: string) => void;
}) {
  const member = brand.member;
  const extra = !brand.isDefault;
  const [bizType, setBizType] = useState('');
  const [bizClass, setBizClass] = useState('');
  const [contactTel, setContactTel] = useState(prefill.contactTel);
  const [contactEmail, setContactEmail] = useState(prefill.contactEmail);
  const [contactName, setContactName] = useState(prefill.contactName);
  const [addr1, setAddr1] = useState(extra ? (member?.addr1 ?? '') : prefill.addr1);
  const [corpNum, setCorpNum] = useState(member?.corpNum ?? '');
  const [corpName, setCorpName] = useState(member?.corpName ?? '');
  const [ceoName, setCeoName] = useState(member?.ceoName ?? '');
  const [imageUrl, setImageUrl] = useState(member?.businessRegistrationImageUrl ?? '');
  const [imageId, setImageId] = useState(member?.businessRegistrationImagePublicId ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [certOpen, setCertOpen] = useState(false);
  const retryable = !member || member.status === 'FAILED' || (extra && member.status === 'REJECTED');
  const locked = !canRegister || !retryable;

  async function onFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadCashbillRegistration(brand.operatingCompanyId, file);
      setImageUrl(uploaded.businessRegistrationImageUrl);
      setImageId(uploaded.businessRegistrationImagePublicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '사업자등록증을 올리지 못했습니다.');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (extra && !isValidKoreanBizNumberChecksum(corpNum)) {
      setError('사업자등록번호 10자리 검증에 맞지 않습니다.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await registerCashbillMember({
        operatingCompanyId: brand.operatingCompanyId,
        bizType,
        bizClass,
        contactTel,
        contactEmail,
        contactName,
        addr1,
        corpNum: extra ? corpNum : undefined,
        corpName: extra ? corpName : undefined,
        ceoName: extra ? ceoName : undefined,
        businessRegistrationImageUrl: extra ? imageUrl : undefined,
        businessRegistrationImagePublicId: extra ? imageId : undefined,
      });
      const label = BAROBILL_MEMBER_STATUS_LABEL[result.status];
      onDone(result.lastError ? `${brand.name}: ${label}. ${result.lastError}` : `${brand.name}: ${label}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const shownCorp = extra ? formatBizNumberDisplay(corpNum || member?.corpNum) : formatBizNumberDisplay(prefill.corpNum);
  const shownName = extra ? corpName || member?.corpName || '상호 없음' : prefill.corpName || '상호 없음';
  const shownCeo = extra ? ceoName || member?.ceoName || '대표자 없음' : prefill.ceoName || '대표자 없음';
  const buttonLabel = saving
    ? '저장 중…'
    : extra
      ? member?.status === 'REJECTED'
        ? '다시 제출'
        : '검토 요청'
      : '연결하기';

  const linked = Boolean(member?.linked);
  const registered = linked && member?.certValid === true;
  const certText = registered
    ? `등록 완료 · 만료일 ${member?.certExpireDate ?? '확인 중'}`
    : null;

  function finishCert(status: { valid: boolean; expireDate: string | null }) {
    setCertOpen(false);
    onDone(`등록 완료 · 만료일 ${status.expireDate ?? ''}`.trim());
  }

  return (
    <section className="space-y-2 rounded-xl border border-gray-200 bg-white p-2 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 truncate text-fluid-sm font-semibold text-slate-900" title={brand.name}>
          {brand.name}
        </h2>
        {brand.isDefault ? (
          <span className="rounded-full bg-slate-100 px-1.5 py-0 text-fluid-2xs text-slate-700 sm:px-2 sm:py-0.5">기본 브랜드</span>
        ) : (
          <span className="rounded-full bg-slate-100 px-1.5 py-0 text-fluid-2xs text-slate-700 sm:px-2 sm:py-0.5">추가 브랜드</span>
        )}
        {member ? (
          <span className={`rounded-full px-1.5 py-0 text-fluid-2xs sm:px-2 sm:py-0.5 ${BADGE[member.status]}`}>
            {BAROBILL_MEMBER_STATUS_LABEL[member.status]}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-1.5 py-0 text-fluid-2xs text-slate-600 sm:px-2 sm:py-0.5">미가입</span>
        )}
      </div>
      <p className="text-fluid-2xs text-slate-600 sm:text-fluid-xs">
        {shownName} · {shownCorp || '사업자번호 없음'} · {shownCeo}
        {member?.taxType ? ` · ${barobillTaxTypeLabel(member.taxType)}` : ''}
      </p>
      {registered ? <p className="text-fluid-2xs text-emerald-800 sm:text-fluid-xs">{certText}</p> : null}
      {linked && registered ? (
        <button type="button" className={BTN} onClick={() => setCertOpen(true)}>
          공동인증서 등록
        </button>
      ) : null}
      {linked && !registered ? (
        <details className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <summary className="cursor-pointer text-fluid-2xs text-slate-700">세금계산서를 쓸 때만 필요</summary>
          <button type="button" className={`${BTN} mt-2`} onClick={() => setCertOpen(true)}>
            공동인증서 등록
          </button>
        </details>
      ) : null}
      {certOpen ? (
        <CashbillCertRegisterModal
          operatingCompanyId={brand.operatingCompanyId}
          onClose={() => setCertOpen(false)}
          onRegistered={finishCert}
        />
      ) : null}
      {extra && !member ? (
        <p className="text-fluid-2xs leading-snug text-slate-600">사업자등록증을 올리면 검토 요청이 됩니다. 승인 전에는 연결하지 않습니다.</p>
      ) : null}
      {member?.rejectReason ? <p className="text-fluid-2xs text-red-800 sm:text-fluid-xs">반려 사유: {member.rejectReason}</p> : null}
      {member?.lastError ? <p className="text-fluid-2xs text-amber-800 sm:text-fluid-xs">{member.lastError}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {extra ? (
          <>
            <label className="block text-fluid-2xs text-slate-600 sm:text-fluid-xs">
              사업자번호
              <input className={INPUT} value={corpNum} disabled={locked || saving} inputMode="numeric" onChange={(e) => setCorpNum(e.target.value)} />
            </label>
            <label className="block text-fluid-2xs text-slate-600 sm:text-fluid-xs">
              상호
              <input className={INPUT} value={corpName} disabled={locked || saving} onChange={(e) => setCorpName(e.target.value)} />
            </label>
            <label className="block text-fluid-2xs text-slate-600 sm:text-fluid-xs">
              대표자
              <input className={INPUT} value={ceoName} disabled={locked || saving} onChange={(e) => setCeoName(e.target.value)} />
            </label>
            <label className="block text-fluid-2xs text-slate-600 sm:col-span-2 sm:text-fluid-xs">
              주소
              <input className={INPUT} value={addr1} disabled={locked || saving} onChange={(e) => setAddr1(e.target.value)} />
            </label>
            <label className="block text-fluid-2xs text-slate-600 sm:col-span-2 sm:text-fluid-xs">
              사업자등록증
              <input
                className={`${INPUT} file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1`}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={locked || saving || uploading}
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {imageUrl ? (
              <a href={imageUrl} target="_blank" rel="noreferrer" className="text-fluid-2xs text-slate-800 underline sm:col-span-2">
                올린 사업자등록증 보기
              </a>
            ) : null}
          </>
        ) : null}
        <label className="block text-fluid-2xs text-slate-600 sm:text-fluid-xs">
          업태
          <input className={INPUT} value={bizType} disabled={locked || saving} onChange={(e) => setBizType(e.target.value)} />
        </label>
        <label className="block text-fluid-2xs text-slate-600 sm:text-fluid-xs">
          종목
          <input className={INPUT} value={bizClass} disabled={locked || saving} onChange={(e) => setBizClass(e.target.value)} />
        </label>
        <label className="block text-fluid-2xs text-slate-600 sm:text-fluid-xs">
          담당 전화
          <input className={INPUT} value={contactTel} disabled={locked || saving} onChange={(e) => setContactTel(e.target.value)} inputMode="tel" />
        </label>
        <label className="block text-fluid-2xs text-slate-600 sm:text-fluid-xs">
          담당 이메일
          <input className={INPUT} value={contactEmail} disabled={locked || saving} onChange={(e) => setContactEmail(e.target.value)} inputMode="email" />
        </label>
        {!prefill.contactName || extra ? (
          <label className="block text-fluid-2xs text-slate-600 sm:text-fluid-xs">
            담당자 이름
            <input className={INPUT} value={contactName} disabled={locked || saving} onChange={(e) => setContactName(e.target.value)} />
          </label>
        ) : null}
        {!extra && !prefill.addr1 ? (
          <label className="block text-fluid-2xs text-slate-600 sm:col-span-2 sm:text-fluid-xs">
            주소
            <input className={INPUT} value={addr1} disabled={locked || saving} onChange={(e) => setAddr1(e.target.value)} />
          </label>
        ) : null}
      </div>
      {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
      <button type="button" className={BTN} disabled={locked || saving || uploading} onClick={() => void submit()}>
        {uploading ? '올리는 중…' : buttonLabel}
      </button>
    </section>
  );
}
