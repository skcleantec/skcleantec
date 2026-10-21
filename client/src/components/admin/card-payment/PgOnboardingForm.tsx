import type { FormEvent } from 'react';
import type { PgOnboardingRow } from '../../../api/cardPayment';
import { TENANT_PG_ONBOARDING_STATUS_LABEL, type TenantPgOnboardingStatus } from '@shared/cardPayment';

const FIELDS: Array<{ key: keyof PgOnboardingRow; label: string; textarea?: boolean }> = [
  { key: 'businessName', label: '상호' },
  { key: 'bizNumber', label: '사업자등록번호' },
  { key: 'representativeName', label: '대표자명' },
  { key: 'representativeBirth', label: '대표자 생년월일' },
  { key: 'addressLine', label: '사업장 주소', textarea: true },
  { key: 'contactName', label: '담당자' },
  { key: 'contactPhone', label: '담당 전화' },
  { key: 'contactEmail', label: '담당 이메일' },
  { key: 'bankName', label: '정산 은행' },
  { key: 'bankAccount', label: '정산 계좌' },
  { key: 'accountHolder', label: '예금주' },
  { key: 'websiteUrl', label: '홈페이지·SNS' },
  { key: 'note', label: '전달 메모', textarea: true },
];

const FILE_INPUT = 'sr-only';
const UPLOAD_BTN =
  'mt-2 inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-dashed border-blue-600 bg-blue-50 px-4 text-fluid-xs font-medium text-slate-900 hover:bg-blue-100 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2';

function UploadSlot({
  label,
  url,
  uploading,
  empty,
  onFile,
}: {
  label: string;
  url: string | null;
  uploading: boolean;
  empty: string;
  onFile: (file: File) => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-blue-600 bg-blue-50 px-3 py-2">
      <p className="text-fluid-2xs font-medium text-slate-800">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block">
          <img src={url} alt={label} className="max-h-40 rounded-lg border border-slate-200 bg-white object-contain" />
        </a>
      ) : (
        <p className="mt-1 text-fluid-2xs text-slate-700">{empty}</p>
      )}
      <label className={`${UPLOAD_BTN} ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
        {uploading ? '올리는 중' : url ? '다시 올리기' : `${label} 올리기`}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className={FILE_INPUT}
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
  onUploadDocument,
  uploadingKey,
  saving,
  submitted,
}: {
  value: PgOnboardingRow;
  onChange: (next: PgOnboardingRow) => void;
  onSave: () => void;
  onSubmit: () => void;
  onUploadRegistration: (file: File) => void;
  onUploadDocument: (kind: 'bankbook' | 'idcard', file: File) => void;
  uploadingKey: string | null;
  saving: boolean;
  submitted: boolean;
}) {
  const set = (key: keyof PgOnboardingRow, v: string) => onChange({ ...value, [key]: v });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const kind = value.merchantKind === 'corp' ? 'corp' : value.merchantKind === 'solo' ? 'solo' : '';
  const soloReady = Boolean(value.businessRegistrationImageUrl && value.bankbookImageUrl && value.idCardImageUrl);

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <p className="text-fluid-2xs text-slate-500">
        상태:{' '}
        <span className="font-medium text-slate-800">
          {TENANT_PG_ONBOARDING_STATUS_LABEL[value.status as TenantPgOnboardingStatus] ?? value.status}
        </span>
      </p>
      <div className="rounded-lg border border-dashed border-blue-600 bg-blue-50 px-3 py-2">
        <p className="text-fluid-2xs font-medium text-slate-800">사업자 구분</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={kind === 'solo'}
            className={`min-h-10 rounded-lg border border-dashed px-3 text-fluid-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${kind === 'solo' ? 'border-blue-700 bg-white text-slate-900' : 'border-blue-600 bg-blue-50 text-slate-800 hover:bg-white'}`}
            onClick={() => set('merchantKind', 'solo')}
          >
            {kind === 'solo' ? '■' : '□'} 개인사업자
          </button>
          <button
            type="button"
            aria-pressed={kind === 'corp'}
            className={`min-h-10 rounded-lg border border-dashed px-3 text-fluid-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${kind === 'corp' ? 'border-blue-700 bg-white text-slate-900' : 'border-blue-600 bg-blue-50 text-slate-800 hover:bg-white'}`}
            onClick={() => set('merchantKind', 'corp')}
          >
            {kind === 'corp' ? '■' : '□'} 법인
          </button>
        </div>
      </div>
      {kind === 'solo' ? (
        <div className="space-y-2">
          <UploadSlot
            label="사업자등록증"
            url={value.businessRegistrationImageUrl}
            uploading={uploadingKey === 'registration'}
            empty="신청할 때 사진을 올립니다."
            onFile={onUploadRegistration}
          />
          <UploadSlot
            label="통장사본"
            url={value.bankbookImageUrl}
            uploading={uploadingKey === 'bankbook'}
            empty="정산 통장 사진을 올립니다."
            onFile={(file) => onUploadDocument('bankbook', file)}
          />
          <UploadSlot
            label="신분증"
            url={value.idCardImageUrl}
            uploading={uploadingKey === 'idcard'}
            empty="대표자 신분증 사진을 올립니다."
            onFile={(file) => onUploadDocument('idcard', file)}
          />
        </div>
      ) : null}
      {kind === 'corp' ? (
        <div className="rounded-lg border border-slate-900 bg-slate-50 px-3 py-2 text-fluid-xs text-slate-800">
          <p className="font-medium">법인 서류는 우편으로 원성페이먼츠 본사에 보냅니다.</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            <li>사업자등록증</li>
            <li>통장사본</li>
            <li>법인인감</li>
            <li>법인등기부</li>
          </ol>
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className={`block min-w-0 ${f.textarea ? 'sm:col-span-2' : ''}`}>
            <span className="text-fluid-2xs text-slate-500">{f.label}</span>
            {f.textarea ? (
              <textarea
                className="login-field-input mt-1 w-full min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs"
                value={String(value[f.key] ?? '')}
                onChange={(e) => set(f.key, e.target.value)}
              />
            ) : (
              <input
                className="login-field-input mt-1 w-full min-h-9 rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs"
                value={String(value[f.key] ?? '')}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          임시 저장
        </button>
        <button
          type="submit"
          disabled={saving || submitted || !kind || (kind === 'solo' && !soloReady)}
          className="min-h-10 rounded-lg bg-slate-900 px-4 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitted ? '신청 완료' : 'PG 신청 제출'}
        </button>
      </div>
    </form>
  );
}
