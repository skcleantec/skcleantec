import type { FormEvent, ReactNode } from 'react';
import type { PgOnboardingRow } from '../../../api/cardPayment';
import { TENANT_PG_ONBOARDING_STATUS_LABEL, type TenantPgOnboardingStatus } from '@shared/cardPayment';
import { LineMdIcon } from '../../ui/LineMdIcon';

const KINDS = [
  { id: 'CORPORATE', label: '법인 사업자' },
  { id: 'SOLE_PROPRIETOR', label: '개인 사업자' },
] as const;

const INPUT = 'login-field-input mt-1 w-full min-h-11 rounded-lg border border-slate-200 px-3 text-fluid-sm';

type ConsentKey = 'consentTerms' | 'consentPrivacy' | 'consentThirdParty' | 'consentIllegalUse' | 'consentMarketing';

const REQUIRED_CONSENT: ConsentKey[] = ['consentTerms', 'consentPrivacy', 'consentThirdParty', 'consentIllegalUse'];

function agreed(row: PgOnboardingRow, key: ConsentKey) {
  if (typeof row[key] === 'boolean') return row[key];
  const at =
    key === 'consentTerms'
      ? row.consentTermsAt
      : key === 'consentPrivacy'
        ? row.consentPrivacyAt
        : key === 'consentThirdParty'
          ? row.consentThirdPartyAt
          : key === 'consentIllegalUse'
            ? row.consentIllegalUseAt
            : row.consentMarketingAt;
  return Boolean(at);
}

function FileBox({
  title,
  hint,
  url,
  alt,
  uploading,
  onFile,
}: {
  title: string;
  hint: string;
  url: string | null;
  alt: string;
  uploading: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-fluid-sm font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-fluid-2xs leading-snug text-slate-500">{hint}</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block">
          <img src={url} alt={alt} className="max-h-36 rounded-lg border border-slate-200 bg-white object-contain" />
        </a>
      ) : (
        <p className="mt-2 text-fluid-2xs text-amber-800">아직 없습니다.</p>
      )}
      <label className={`mt-2 inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-slate-400 focus-within:ring-offset-2 ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
        {uploading ? '올리는 중' : url ? '다시 올리기' : '사진 올리기'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onFile(file);
          }}
        />
      </label>
    </div>
  );
}

export function PgOnboardingForm({
  value,
  onChange,
  onSave,
  onSubmit,
  onUploadRegistration,
  onUploadBusinessCard,
  saving,
  uploading,
  uploadingCard,
  submitted,
}: {
  value: PgOnboardingRow;
  onChange: (next: PgOnboardingRow) => void;
  onSave: () => void;
  onSubmit: () => void;
  onUploadRegistration: (file: File) => void;
  onUploadBusinessCard: (file: File) => void;
  saving: boolean;
  uploading: boolean;
  uploadingCard: boolean;
  submitted: boolean;
}) {
  const set = (key: keyof PgOnboardingRow, v: string) => onChange({ ...value, [key]: v });
  const setConsent = (key: ConsentKey, on: boolean) => onChange({ ...value, [key]: on });
  const allOn = [...REQUIRED_CONSENT, 'consentMarketing' as const].every((key) => agreed(value, key));
  const requiredOn = REQUIRED_CONSENT.every((key) => agreed(value, key));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-fluid-base font-semibold text-slate-900">신청서 작성</h2>
        <p className="mt-1 text-fluid-2xs leading-snug text-slate-500">
          사업자등록이 있는 법인·개인사업자만 신청할 수 있습니다. 적은 내용은 가맹 심사를 위해 원성페이먼츠에 전달됩니다.
        </p>
        <p className="mt-1 text-fluid-2xs text-slate-500">
          상태:{' '}
          <span className="font-medium text-slate-800">
            {TENANT_PG_ONBOARDING_STATUS_LABEL[value.status as TenantPgOnboardingStatus] ?? value.status}
          </span>
        </p>
      </div>

      <fieldset>
        <legend className="text-fluid-xs font-medium text-slate-800">사업자 구분 <span className="text-red-600">*</span></legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {KINDS.map((kind) => {
            const on = value.businessKind === kind.id;
            return (
              <button
                key={kind.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ ...value, businessKind: kind.id })}
                className={`min-h-10 rounded-full border px-3 text-fluid-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${on ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {kind.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">사업자등록번호 <span className="text-red-600">*</span></span>
          <input className={INPUT} value={value.bizNumber ?? ''} onChange={(e) => set('bizNumber', e.target.value)} placeholder="123-45-67890" autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">상호 / 매장명 <span className="text-red-600">*</span></span>
          <input className={INPUT} value={value.businessName ?? ''} onChange={(e) => set('businessName', e.target.value)} autoComplete="organization" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">대표자 이름 <span className="text-red-600">*</span></span>
          <input className={INPUT} value={value.representativeName ?? ''} onChange={(e) => set('representativeName', e.target.value)} autoComplete="name" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">담당자 (대표자가 아닌 경우)</span>
          <input className={INPUT} value={value.contactName ?? ''} onChange={(e) => set('contactName', e.target.value)} autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">휴대전화 <span className="text-red-600">*</span></span>
          <input className={INPUT} value={value.contactPhone ?? ''} onChange={(e) => set('contactPhone', e.target.value)} inputMode="tel" autoComplete="tel" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">이메일 <span className="text-red-600">*</span></span>
          <input className={INPUT} type="email" value={value.contactEmail ?? ''} onChange={(e) => set('contactEmail', e.target.value)} autoComplete="email" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-fluid-2xs text-slate-500">사업장 주소</span>
          <input className={INPUT} value={value.addressLine ?? ''} onChange={(e) => set('addressLine', e.target.value)} autoComplete="street-address" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">정산 은행</span>
          <input className={INPUT} value={value.bankName ?? ''} onChange={(e) => set('bankName', e.target.value)} autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">정산 계좌</span>
          <input className={INPUT} value={value.bankAccount ?? ''} onChange={(e) => set('bankAccount', e.target.value)} autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">예금주</span>
          <input className={INPUT} value={value.accountHolder ?? ''} onChange={(e) => set('accountHolder', e.target.value)} autoComplete="off" />
        </label>
      </div>
      <section className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-fluid-xs font-medium text-slate-800">신청 서비스</p>
        <p className="mt-1 text-fluid-sm text-slate-900">수기결제, 인증결제</p>
        <p className="mt-1 text-fluid-2xs text-slate-500">가맹점 카드결재는 이 두 가지입니다. 다른 결제 채널은 신청하지 않습니다.</p>
      </section>

      {value.businessKind === 'CORPORATE' ? (
        <div className="rounded-lg border border-slate-900 bg-slate-50 px-3 py-2 text-fluid-xs text-slate-800">
          <p className="font-medium">법인 서류는 우편으로 원성페이먼츠에 보냅니다.</p>
          <p className="mt-1 leading-snug">
            서울특별시 송파구 위례서로 252, 503,504,505호
            <br />
            전화 1555-0985
          </p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            <li>사업자등록증</li>
            <li>통장사본</li>
            <li>법인인감</li>
            <li>법인등기부</li>
          </ol>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <FileBox
          title="사업자등록증 *"
          hint="원성페이먼츠가 사업자를 확인합니다."
          url={value.businessRegistrationImageUrl}
          alt="사업자등록증"
          uploading={uploading}
          onFile={onUploadRegistration}
        />
        <FileBox
          title="명함 *"
          hint="담당자 확인용입니다. 글자가 보이게 찍어 주세요."
          url={value.businessCardImageUrl}
          alt="명함"
          uploading={uploadingCard}
          onFile={onUploadBusinessCard}
        />
      </div>

      <label className="block">
        <span className="text-fluid-2xs text-slate-500">요청 사항 (선택)</span>
        <textarea
          className="login-field-input mt-1 w-full min-h-24 rounded-lg border border-slate-200 px-3 py-2 text-fluid-sm"
          value={value.note ?? ''}
          onChange={(e) => set('note', e.target.value)}
          placeholder="도입 일정 등 전달할 내용이 있으면 적어 주세요."
        />
      </label>

      <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-xs leading-snug text-amber-950">
        <LineMdIcon name="alert-circle" className="mt-0.5 size-4 shrink-0" />
        <p>서류를 대조하다가 의심이 되면 신청이 반려될 수 있습니다. 반려되면 내용을 고쳐 다시 신청할 수 있습니다.</p>
      </div>

      <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3">
        <legend className="px-1 text-fluid-xs font-medium text-slate-800">동의</legend>
        <label className="flex min-h-10 items-start gap-2 text-fluid-xs text-slate-900">
          <input
            type="checkbox"
            className="mt-1"
            checked={allOn}
            onChange={(e) => {
              const on = e.target.checked;
              onChange({
                ...value,
                consentTerms: on,
                consentPrivacy: on,
                consentThirdParty: on,
                consentIllegalUse: on,
                consentMarketing: on,
              });
            }}
          />
          <span>전체 동의 (필수 항목 + 선택 마케팅)</span>
        </label>
        <ConsentRow
          required
          checked={agreed(value, 'consentTerms')}
          title="이용 안내"
          onChange={(on) => setConsent('consentTerms', on)}
        >
          청소 대금의 수기결제와 인증결제를 받기 위해 가맹을 신청합니다. 신청 내용은 청소비서가 원성페이먼츠에 전달하고, 심사가 끝나기 전에는 팀장이 카드결재를 쓸 수 없습니다.
        </ConsentRow>
        <ConsentRow
          required
          checked={agreed(value, 'consentPrivacy')}
          title="개인정보 수집·이용"
          onChange={(on) => setConsent('consentPrivacy', on)}
        >
          수집 항목은 상호, 사업자등록번호, 대표자, 담당자, 전화, 이메일, 주소, 정산 계좌, 사업자등록증, 명함, 요청 사항입니다. 목적은 가맹 신청과 심사, 수기결제·인증결제 연결, 정산입니다. 가맹이 유지되는 동안과 관련 법령이 정한 기간 동안 보관합니다.
        </ConsentRow>
        <ConsentRow
          required
          checked={agreed(value, 'consentThirdParty')}
          title="개인정보 제3자 제공"
          onChange={(on) => setConsent('consentThirdParty', on)}
        >
          제공받는 곳: 원성페이먼츠(선샤인페이). 제공 목적: 가맹 심사, 수기결제·인증결제 연결, 정산, 판매자센터 계정 발급. 제공 항목: 위 수집 항목과 같습니다. 민감한 사업자 정보이므로, 동의하지 않으면 신청을 보내지 않습니다. 원성페이먼츠는 가맹 계약과 법령이 정한 기간 동안 보관합니다.
        </ConsentRow>
        <ConsentRow
          required
          checked={agreed(value, 'consentIllegalUse')}
          title="금지 업종·불법 이용"
          onChange={(on) => setConsent('consentIllegalUse', on)}
        >
          이 가맹은 청소 서비스 대금의 수기결제·인증결제만 사용합니다. 도박·사행산업, 보이스피싱, 유흥업소를 이용한 카드깡이나 그 밖에 청소 대금이 아닌 용도로 쓰면 신청이 반려되거나 가맹이 해지되고, 관계 법령에 따라 처벌될 수 있습니다.
          {' '}도박은 형법 제246조·제247조, 게임물을 이용한 사행행위는 게임산업진흥에 관한 법률 제28조 제2호·제44조.
          {' '}보이스피싱 등 전기통신금융사기는 전기통신금융사기 피해 방지 및 피해금 환급에 관한 특별법 제15조의2(1년 이상의 유기징역 또는 범죄수익의 3배 이상 5배 이하 벌금)와 형법 제347조(사기).
          {' '}물품·용역 거래를 가장하거나 실제 매출을 넘겨 카드로 자금을 융통하는 카드깡, 그 중개·알선은 여신전문금융업법 제70조 제3항 제2호에 따라 3년 이하의 징역 또는 2천만원 이하의 벌금입니다.
          {' '}다른 가맹점 명의를 빌려 거래하거나 명의를 빌려 주면 같은 법 제70조 제4항 제6호에 따라 1년 이하의 징역 또는 1천만원 이하의 벌금입니다.
        </ConsentRow>
        <ConsentRow
          checked={agreed(value, 'consentMarketing')}
          title="마케팅 정보 수신"
          onChange={(on) => setConsent('consentMarketing', on)}
        >
          가맹·결제 안내를 전화나 이메일로 받을 수 있습니다. 동의하지 않아도 신청은 가능합니다.
        </ConsentRow>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          임시 저장
        </button>
        <button
          type="submit"
          disabled={saving || submitted || !requiredOn}
          className="inline-flex min-h-11 items-center rounded-full bg-slate-900 px-5 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {submitted ? '신청 완료' : '가입 신청 보내기'}
        </button>
        <p className="text-fluid-2xs text-slate-500">심사 후 영업일 기준으로 연락합니다.</p>
      </div>
    </form>
  );
}

function ConsentRow({
  title,
  required,
  checked,
  onChange,
  children,
}: {
  title: string;
  required?: boolean;
  checked: boolean;
  onChange: (on: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-100 px-2 py-2">
      <label className="flex min-h-10 items-start gap-2 text-fluid-xs text-slate-900">
        <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>({required ? '필수' : '선택'}) {title}에 동의합니다.</span>
      </label>
      <p className="mt-1 pl-6 text-fluid-2xs leading-relaxed text-slate-600">{children}</p>
    </div>
  );
}
