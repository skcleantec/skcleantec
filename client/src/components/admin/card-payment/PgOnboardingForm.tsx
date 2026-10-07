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
  saving,
  submitted,
}: {
  value: PgOnboardingRow;
  onChange: (next: PgOnboardingRow) => void;
  onSave: () => void;
  onSubmit: () => void;
  saving: boolean;
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
          disabled={saving || submitted}
          className="min-h-10 rounded-lg bg-slate-900 px-4 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitted ? '신청 완료' : '가입 정보 제출'}
        </button>
      </div>
    </form>
  );
}
