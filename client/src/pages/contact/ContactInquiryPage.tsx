import { useEffect, useMemo, useState } from 'react';
import { resolveInitialTenantSlug } from '../../utils/tenantHostResolve';
import { resolvePublicBrandSlug } from '../../utils/publicTenantQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  fetchLandingContactPublicForm,
  submitLandingContactInquiry,
  type LandingContactPublicForm,
} from '../../api/landingContact';
import type { LandingContactCustomFieldDef } from '@shared/landingContactForm';

const inputCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-fluid-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';

function CustomFieldInput(props: {
  field: LandingContactCustomFieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const { field, value, onChange } = props;
  const common = {
    className: inputCls,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    placeholder: field.placeholder ?? field.label,
    required: field.required,
  };
  if (field.type === 'textarea') {
    return <textarea {...common} rows={3} />;
  }
  return (
    <input
      {...common}
      type={field.type === 'number' ? 'text' : field.type}
      inputMode={field.type === 'number' ? 'numeric' : field.type === 'tel' ? 'tel' : undefined}
    />
  );
}

export function ContactInquiryPage() {
  const tenantSlug = useMemo(() => resolveInitialTenantSlug(), []);
  const brandSlug = useMemo(() => resolvePublicBrandSlug(), []);
  const [formConfig, setFormConfig] = useState<LandingContactPublicForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [content, setContent] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageTitle = formConfig?.title?.trim() || `${formConfig?.displayName ?? '문의'} — 문의하기`;
  useDocumentTitle(pageTitle);

  useEffect(() => {
    if (!tenantSlug) {
      setLoadError('업체 정보를 확인할 수 없습니다. 링크에 업체 코드가 포함되어 있는지 확인해 주세요.');
      setLoading(false);
      return;
    }
    void fetchLandingContactPublicForm(tenantSlug, brandSlug)
      .then(setFormConfig)
      .catch((e) => setLoadError(e instanceof Error ? e.message : '문의 폼을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [tenantSlug, brandSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantSlug || !formConfig) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitLandingContactInquiry({
        tenantSlug,
        brandSlug: brandSlug ?? formConfig.brandSlug,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        content: content.trim(),
        customFieldValues: customValues,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '문의 접수에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
      </div>
    );
  }

  if (loadError || !formConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="text-fluid-sm text-gray-700">{loadError ?? '문의 폼을 사용할 수 없습니다.'}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
        <div className="w-full max-w-lg rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-gray-900">문의가 접수되었습니다</p>
          <p className="mt-2 text-fluid-sm text-gray-600">빠른 시일 내에 연락드리겠습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="mx-auto max-w-lg px-4 py-8">
        <header className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
          {formConfig.introText ? (
            <p className="mt-2 whitespace-pre-line text-fluid-sm text-gray-600">{formConfig.introText}</p>
          ) : (
            <p className="mt-2 text-fluid-sm text-gray-500">아래 내용을 입력해 주시면 담당자가 연락드립니다.</p>
          )}
        </header>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-fluid-xs font-medium text-gray-700">
              성함 <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              className={inputCls}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div>
            <label className="mb-1 block text-fluid-xs font-medium text-gray-700">
              연락처 <span className="text-red-600">*</span>
            </label>
            <input
              type="tel"
              className={inputCls}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              required
              autoComplete="tel"
            />
          </div>
          <div>
            <label className="mb-1 block text-fluid-xs font-medium text-gray-700">
              문의 내용 <span className="text-red-600">*</span>
            </label>
            <textarea
              className={inputCls}
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>
          {formConfig.customFields.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-fluid-xs font-medium text-gray-700">
                {field.label}
                {field.required ? <span className="text-red-600"> *</span> : null}
              </label>
              <CustomFieldInput
                field={field}
                value={customValues[field.key] ?? ''}
                onChange={(v) => setCustomValues((prev) => ({ ...prev, [field.key]: v }))}
              />
            </div>
          ))}
          {error ? <p className="text-fluid-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-slate-900 py-3 text-fluid-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? '접수 중…' : '문의하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
