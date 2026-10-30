import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatBizNumberDisplay, isValidKoreanBizNumberChecksum } from '@shared/authSignup';
import { isBlankSupplierField, visibleSupplierField } from '@shared/supplierFieldText';
import type { CashbillSettings } from '../../api/cashbill';
import { registerCashbillMember, updateCashbillMemberContact, uploadCashbillRegistration } from '../../api/cashbill';
import { patchTenantCompanyProfile } from '../../api/tenantCompanyProfile';
import { getToken } from '../../stores/auth';

const BUSINESS_PATH = '/admin/team-leaders/company-profile/business';
const LINK_BTN =
  'inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-fluid-xs font-medium text-slate-900 hover:bg-slate-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';

const INPUT =
  'mt-1 block w-full min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-fluid-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const BTN =
  'min-h-11 w-full rounded-lg bg-slate-900 px-4 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none sm:w-auto';

type Brand = CashbillSettings['brands'][number];

export function CashbillLinkForm({
  brand,
  prefill,
  missing = [],
  canEditCompany = true,
  canRegister,
  mode,
  onDone,
}: {
  brand: Brand;
  prefill: CashbillSettings['prefill'];
  missing?: CashbillSettings['missing'];
  canEditCompany?: boolean;
  canRegister: boolean;
  mode: 'join' | 'edit';
  onDone: (message: string) => void;
}) {
  const member = brand.member;
  const extra = !brand.isDefault && mode === 'join';
  const [bizType, setBizType] = useState(member?.bizType ?? '');
  const [bizClass, setBizClass] = useState(member?.bizClass ?? '');
  const [contactTel, setContactTel] = useState(member?.contactTel || prefill.contactTel);
  const [contactEmail, setContactEmail] = useState(member?.contactEmail || prefill.contactEmail);
  const contactName = member?.contactName || prefill.contactName;
  const [addr1, setAddr1] = useState(visibleSupplierField(extra ? member?.addr1 : prefill.addr1));
  const [corpNum, setCorpNum] = useState(extra ? (member?.corpNum ?? '') : '');
  const [corpName, setCorpName] = useState(visibleSupplierField(extra ? member?.corpName : ''));
  const [ceoName, setCeoName] = useState(visibleSupplierField(extra ? member?.ceoName : ''));
  const [gapAddr, setGapAddr] = useState('');
  const [imageUrl, setImageUrl] = useState(member?.businessRegistrationImageUrl ?? '');
  const [imageId, setImageId] = useState(member?.businessRegistrationImagePublicId ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gapOpen = !extra && mode === 'join' && missing.length > 0;
  const gapValue = (key: CashbillSettings['missing'][number]) => (
    key === 'corpNum' ? corpNum : key === 'corpName' ? corpName : key === 'ceoName' ? ceoName : gapAddr
  );
  const gapsFilled = !gapOpen || missing.every((key) => !isBlankSupplierField(gapValue(key)) && (key !== 'corpNum' || corpNum.replace(/\D/g, '').length === 10));
  const ready = bizType.trim() && bizClass.trim() && contactTel.trim() && contactEmail.trim() && gapsFilled && (!extra || (corpName.trim() && ceoName.trim() && imageUrl));
  const locked = (!canRegister && mode === 'join') || (gapOpen && !canEditCompany);

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
      if (mode === 'edit') {
        await updateCashbillMemberContact({
          operatingCompanyId: brand.operatingCompanyId,
          bizType,
          bizClass,
          contactTel,
          contactEmail,
          contactName,
        });
        onDone(`${brand.name}: 연락 정보를 저장했습니다.`);
        return;
      }
      if (gapOpen && canEditCompany) {
        if (missing.includes('corpNum') && !isValidKoreanBizNumberChecksum(corpNum)) {
          setError('사업자등록번호 10자리 검증에 맞지 않습니다.');
          setSaving(false);
          return;
        }
        const token = getToken();
        if (!token) throw new Error('다시 로그인해 주세요.');
        const companyRegistration: {
          businessRegistrationNo?: string;
          companyName?: string;
          representativeName?: string;
          addressLine?: string;
        } = {};
        if (missing.includes('corpNum')) companyRegistration.businessRegistrationNo = corpNum;
        if (missing.includes('corpName')) companyRegistration.companyName = corpName.trim();
        if (missing.includes('ceoName')) companyRegistration.representativeName = ceoName.trim();
        if (missing.includes('addr1')) companyRegistration.addressLine = gapAddr.trim();
        await patchTenantCompanyProfile(token, { companyRegistration });
      }
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
      onDone(result.lastError ? `${brand.name}: ${result.status}. ${result.lastError}` : `${brand.name}: 연결을 요청했습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const buttonLabel = mode === 'edit' ? '저장' : extra ? (member?.status === 'REJECTED' ? '다시 제출' : '검토 요청') : '바로빌 연결하기';
  const businessSummary = [prefill.corpName, prefill.ceoName, prefill.addr1].map((part) => part.trim()).filter(Boolean).join(' · ');

  return (
    <div className="max-w-[640px] space-y-2">
      {!extra && mode === 'join' ? (
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-fluid-xs text-slate-700" title={businessSummary || undefined}>
            <span className="mr-1 font-medium text-slate-500">사업자정보</span>
            {businessSummary}
          </p>
          <Link to={BUSINESS_PATH} className={LINK_BTN}>수정</Link>
        </div>
      ) : null}
      {mode === 'join' ? <p className="text-fluid-xs font-medium text-slate-800">연결 정보 입력</p> : null}
      {extra ? (
        <p className="text-fluid-2xs text-slate-600">
          {formatBizNumberDisplay(corpNum) || '사업자번호'} · {corpName || '상호'} · {ceoName || '대표자'}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {extra ? (
          <>
            <label className="text-fluid-xs text-slate-700">사업자번호<input className={INPUT} value={corpNum} disabled={locked || saving} inputMode="numeric" onChange={(e) => setCorpNum(e.target.value)} /></label>
            <label className="text-fluid-xs text-slate-700">상호<input className={INPUT} value={corpName} placeholder="상호" disabled={locked || saving} onChange={(e) => setCorpName(e.target.value)} /></label>
            <label className="text-fluid-xs text-slate-700">대표자<input className={INPUT} value={ceoName} placeholder="대표자명" disabled={locked || saving} onChange={(e) => setCeoName(e.target.value)} /></label>
            <label className="text-fluid-xs text-slate-700 lg:col-span-2">주소<input className={INPUT} value={addr1} placeholder="사업장 주소" disabled={locked || saving} onChange={(e) => setAddr1(e.target.value)} /></label>
            <label className="text-fluid-xs text-slate-700 lg:col-span-2">
              사업자등록증
              <input className={INPUT} type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={locked || saving || uploading} onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
            </label>
          </>
        ) : null}
        {gapOpen && canEditCompany ? (
          <>
            {missing.includes('corpNum') ? <label className="text-fluid-xs text-slate-700">사업자번호<input className={INPUT} value={corpNum} disabled={saving} inputMode="numeric" onChange={(e) => setCorpNum(e.target.value)} /></label> : null}
            {missing.includes('corpName') ? <label className="text-fluid-xs text-slate-700">상호<input className={INPUT} value={corpName} placeholder="상호" disabled={saving} onChange={(e) => setCorpName(e.target.value)} /></label> : null}
            {missing.includes('ceoName') ? <label className="text-fluid-xs text-slate-700">대표자<input className={INPUT} value={ceoName} placeholder="대표자명" disabled={saving} onChange={(e) => setCeoName(e.target.value)} /></label> : null}
            {missing.includes('addr1') ? <label className="text-fluid-xs text-slate-700 lg:col-span-2">주소<input className={INPUT} value={gapAddr} placeholder="사업장 주소" disabled={saving} onChange={(e) => setGapAddr(e.target.value)} /></label> : null}
          </>
        ) : null}
        {gapOpen && !canEditCompany ? (
          <p className="text-fluid-xs text-amber-900 lg:col-span-2">
            사업자정보 화면에서 입력해 주세요{' '}
            <Link to={BUSINESS_PATH} className={LINK_BTN}>사업자정보</Link>
          </p>
        ) : null}
        <label className="text-fluid-xs text-slate-700">업태<input className={INPUT} value={bizType} disabled={locked || saving} onChange={(e) => setBizType(e.target.value)} /></label>
        <label className="text-fluid-xs text-slate-700">종목<input className={INPUT} value={bizClass} disabled={locked || saving} onChange={(e) => setBizClass(e.target.value)} /></label>
        <label className="text-fluid-xs text-slate-700">담당 전화<input className={INPUT} value={contactTel} disabled={locked || saving} inputMode="tel" onChange={(e) => setContactTel(e.target.value)} /></label>
        <label className="text-fluid-xs text-slate-700">담당 이메일<input className={INPUT} value={contactEmail} disabled={locked || saving} inputMode="email" onChange={(e) => setContactEmail(e.target.value)} /></label>
      </div>
      {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
      <button type="button" className={`${BTN}${mode === 'edit' ? ' sticky bottom-0 z-10 bg-slate-900' : ''}`} disabled={locked || saving || uploading || !ready} onClick={() => void submit()}>
        {uploading ? '올리는 중…' : saving ? '저장 중…' : buttonLabel}
      </button>
    </div>
  );
}
