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

export function PgOnboardingForm({
  value,
  onChange,
  onSave,
  onSubmit,
  onUploadRegistration,
  saving,
  uploading,
  submitted,
}: {
  value: PgOnboardingRow;
  onChange: (next: PgOnboardingRow) => void;
  onSave: () => void;
  onSubmit: () => void;
  onUploadRegistration: (file: File) => void;
  saving: boolean;
  uploading: boolean;
  submitted: boolean;
}) {
  const set = (key: keyof PgOnboardingRow, v: string) => onChange({ ...value, [key]: v });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit} onFocusCapture={undefined}>
      <p className="text-fluid-2xs text-slate-500">
        상태:{' '}
        <span className="font-medium text-slate-800">
          {TENANT_PG_ONBOARDING_STATUS_LABEL[value.status as TenantPgOnboardingStatus] ?? value.status}
        </span>
      </p>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-fluid-2xs font-medium text-slate-800">사업자등록증</p>
        {value.businessRegistrationImageUrl ? (
          <>
            <p className="mt-1 text-fluid-2xs text-slate-600">청소비서에 등록된 파일이 원성에 전달됩니다.</p>
            <a href={value.businessRegistrationImageUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block">
              <img
                src={value.businessRegistrationImageUrl}
                alt="사업자등록증"
                className="max-h-40 rounded-lg border border-slate-200 bg-white object-contain"
              />
            </a>
          </>
        ) : (
          <>
            <p className="mt-1 text-fluid-2xs text-amber-800">등록된 사업자등록증이 없습니다. 이미지를 올려야 PG 신청을 제출할 수 있습니다.</p>
            <label className={`mt-2 inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-slate-900 px-4 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-within:ring-2 focus-within:ring-slate-400 focus-within:ring-offset-2 ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
              {uploading ? '올리는 중' : '사업자등록증 올리기'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) onUploadRegistration(file);
                }}
              />
            </label>
          </>
        )}
      </div>
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
          disabled={saving || submitted || !value.businessRegistrationImageUrl}
          className="min-h-10 rounded-lg bg-slate-900 px-4 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitted ? '신청 완료' : 'PG 신청 제출'}
        </button>
      </div>
    </form>
  );
}
