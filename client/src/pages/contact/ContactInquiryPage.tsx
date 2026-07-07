import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  'w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-fluid-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/15 touch-manipulation';

const textareaCls = `${inputCls} min-h-[120px] resize-y py-3`;

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-fluid-sm font-medium text-slate-700">
      {children}
      {required ? <span className="text-red-600"> *</span> : null}
    </label>
  );
}

function CustomFieldInput(props: {
  field: LandingContactCustomFieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const { field, value, onChange } = props;

  if (field.type === 'select') {
    return (
      <select
        className={inputCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      >
        <option value="">{field.placeholder ?? `${field.label} 선택`}</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        className={textareaCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? field.label}
        required={field.required}
        rows={3}
      />
    );
  }

  return (
    <input
      className={inputCls}
      type={field.type === 'number' ? 'text' : field.type}
      inputMode={field.type === 'number' ? 'numeric' : field.type === 'tel' ? 'tel' : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? field.label}
      required={field.required}
    />
  );
}

function ContactPlatformFooter() {
  return (
    <footer className="mt-8">
      <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-5 text-center shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Powered by</p>
        <p className="mt-1.5 text-fluid-sm font-semibold text-slate-800">
          청소전문 솔루션 <span className="text-slate-900">청소비서</span>
        </p>
        <p className="mx-auto mt-2 max-w-xs text-fluid-xs leading-relaxed text-slate-500">
          전문 청소 플랫폼으로 안전하게 접수·관리됩니다. 입력하신 정보는 담당 업체에만 전달됩니다.
        </p>
      </div>
    </footer>
  );
}

function PageShell({
  brandTitle,
  introLine,
  children,
}: {
  brandTitle: string;
  introLine?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = '#f1f5f9';
    document.documentElement.style.backgroundColor = '#f1f5f9';
    return () => {
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
    };
  }, []);

  return (
    <div className="flex min-h-dvh w-full flex-1 flex-col bg-slate-100">
      <header className="shrink-0 bg-slate-900 text-white">
        <div className="mx-auto max-w-lg px-4 py-4 sm:py-5">
          <p className="text-fluid-xs uppercase tracking-wider text-slate-400">Service Inquiry</p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{brandTitle}</h1>
          {introLine ? (
            <p className="mt-1 text-fluid-sm leading-snug text-slate-300">{introLine}</p>
          ) : (
            <p className="mt-1 text-fluid-sm leading-snug text-slate-300">
              아래 양식을 작성해 주시면 담당자가 빠르게 연락드립니다.
            </p>
          )}
        </div>
      </header>
      <main className="mx-auto min-w-0 w-full max-w-lg flex-1 bg-slate-100 px-4 py-6 pb-10 sm:py-8">{children}</main>
    </div>
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

  const brandTitle =
    formConfig?.title?.trim() || (formConfig ? `${formConfig.displayName} 문의` : '문의하기');
  useDocumentTitle(brandTitle);

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
      <PageShell brandTitle="문의하기">
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          <p className="text-fluid-sm">불러오는 중…</p>
        </div>
      </PageShell>
    );
  }

  if (loadError || !formConfig) {
    return (
      <PageShell brandTitle="문의하기">
        <div className="rounded-2xl border border-slate-100 bg-white px-6 py-10 text-center shadow-xl shadow-slate-300/35">
          <p className="text-fluid-sm leading-relaxed text-slate-700">
            {loadError ?? '문의 폼을 사용할 수 없습니다.'}
          </p>
        </div>
        <ContactPlatformFooter />
      </PageShell>
    );
  }

  if (submitted) {
    return (
      <PageShell brandTitle={brandTitle}>
        <div className="rounded-2xl border border-slate-100 bg-white px-6 py-10 text-center shadow-xl shadow-slate-300/35">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50">
            <svg
              className="h-7 w-7 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900 sm:text-xl">문의가 접수되었습니다</h2>
          <p className="mx-auto max-w-sm text-fluid-sm leading-relaxed text-slate-600">
            {customerName ? (
              <>
                <span className="font-medium text-slate-800">{customerName}</span>님, 문의가 정상적으로
                접수되었습니다.
              </>
            ) : (
              '문의가 정상적으로 접수되었습니다.'
            )}
            <br />
            <span className="text-slate-500">빠른 시일 내에 담당자가 연락드리겠습니다.</span>
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-fluid-xs text-slate-600">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            접수 완료 · 연락 대기
          </div>
        </div>
        <ContactPlatformFooter />
      </PageShell>
    );
  }

  const introLine = formConfig.introText?.trim() || undefined;

  return (
    <PageShell brandTitle={brandTitle} introLine={introLine}>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-300/35">
        <div className="border-b border-slate-100 bg-white px-5 pb-4 pt-6 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">청소 문의 접수</h2>
          <p className="mt-1 text-fluid-sm text-slate-500">
            연락처와 현장 정보를 남겨 주시면 맞춤 견적 안내를 도와드립니다.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6 px-5 py-5 sm:px-6">
          <section className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">1. 연락처</p>
              <p className="mt-0.5 text-fluid-xs text-slate-500">담당자가 연락드릴 정보를 입력해 주세요.</p>
            </div>
            <div>
              <FieldLabel required>성함</FieldLabel>
              <input
                type="text"
                className={inputCls}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                autoComplete="name"
                placeholder="홍길동"
              />
            </div>
            <div>
              <FieldLabel required>연락처</FieldLabel>
              <input
                type="tel"
                className={inputCls}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                required
                autoComplete="tel"
                placeholder="010-0000-0000"
              />
            </div>
          </section>

          {formConfig.customFields.length > 0 ? (
            <section className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">2. 청소 현장 정보</p>
                <p className="mt-0.5 text-fluid-xs text-slate-500">
                  정확한 견적을 위해 평수·건축물 유형을 입력해 주세요.
                </p>
              </div>
              {formConfig.customFields.map((field) => (
                <div key={field.key}>
                  <FieldLabel required={field.required}>{field.label}</FieldLabel>
                  <CustomFieldInput
                    field={field}
                    value={customValues[field.key] ?? ''}
                    onChange={(v) => setCustomValues((prev) => ({ ...prev, [field.key]: v }))}
                  />
                </div>
              ))}
            </section>
          ) : null}

          <section className="space-y-4">
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-800">
                {formConfig.customFields.length > 0 ? '3. 문의 내용' : '2. 문의 내용'}
              </p>
            </div>
            <div>
              <FieldLabel required>문의 내용</FieldLabel>
              <textarea
                className={textareaCls}
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                placeholder="희망 일정, 특이사항, 궁금한 점 등을 자유롭게 적어 주세요."
              />
            </div>
          </section>

          {error ? (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-fluid-sm text-red-800">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] rounded-xl bg-slate-900 py-3 text-fluid-sm font-semibold text-white shadow-md shadow-slate-900/15 transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-45 touch-manipulation"
          >
            {submitting ? '접수 중…' : '문의 접수하기'}
          </button>
        </form>
      </div>

      <ContactPlatformFooter />
    </PageShell>
  );
}
