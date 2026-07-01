import { useEffect, useMemo, useRef, useState } from 'react';
import type { TelecrmCustomerLookupDto } from '../../../api/telecrm';
import type { CrmIntakeFormSnapshot } from '../../../utils/crmIntakeDraft';
import type { CrmIntakeSubmitResult } from './crmIntakeSubmit';
import { CrmColumn } from '../layout/CrmShell';
import { CrmIntakeForm } from './CrmIntakeForm';
import { CrmCustomerHistoryPanel } from '../customer/CrmCustomerHistoryPanel';
import { useCrmCustomerLookup } from '../../../hooks/useCrmCustomerLookup';

export type CrmCustomerMode = 'new' | 'existing';

function formatPyeongValue(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '';
  return String(n);
}

export function CrmIntakePanel({
  mode,
  onModeChange,
  phone,
  onPhoneChange,
  onCustomerNameChange,
  pyeong,
  onPyeongChange,
  onOpenInquiryEdit,
  lookupRefreshKey,
  onSaved,
  initialFormDraft,
  onFormChange,
  skipAutoFillPhone,
}: {
  mode: CrmCustomerMode;
  onModeChange: (m: CrmCustomerMode) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  onCustomerNameChange: (name: string) => void;
  pyeong: string;
  onPyeongChange: (v: string) => void;
  onOpenInquiryEdit: (inquiryId: string) => void;
  lookupRefreshKey: number;
  onSaved: () => void;
  initialFormDraft?: Partial<CrmIntakeFormSnapshot> | null;
  onFormChange?: (snapshot: CrmIntakeFormSnapshot) => void;
  skipAutoFillPhone?: string | null;
}) {
  const lookupEnabled = mode === 'existing' && phone.trim().length >= 4;
  const { data, loading, error, refresh } = useCrmCustomerLookup(phone, lookupEnabled);
  const [lastInquiryId, setLastInquiryId] = useState<string | null>(null);
  const [formSeed, setFormSeed] = useState({
    customerName: '',
    nickname: '',
    phone: '',
    memo: '',
    address: '',
  });
  const autoFilledPhoneRef = useRef<string | null>(null);

  useEffect(() => {
    if (skipAutoFillPhone) autoFilledPhoneRef.current = skipAutoFillPhone;
  }, [skipAutoFillPhone]);

  useEffect(() => {
    if (lookupRefreshKey > 0 && mode === 'existing') refresh();
  }, [lookupRefreshKey, mode, refresh]);

  const intakeSeed = useMemo(
    () => ({
      ...formSeed,
      phone,
      pyeong,
    }),
    [formSeed, phone, pyeong],
  );

  const applyCustomer = (
    customer: TelecrmCustomerLookupDto['customer'],
    latestInquiry?: TelecrmCustomerLookupDto['inquiries'][number],
  ) => {
    setFormSeed({
      customerName: customer.name ?? '',
      nickname: customer.nickname ?? '',
      phone: customer.phone,
      memo: '',
      address: customer.lastAddress ?? latestInquiry?.address ?? '',
    });
    onCustomerNameChange(customer.name ?? '');
    const nextPyeong = formatPyeongValue(latestInquiry?.areaPyeong);
    if (nextPyeong) onPyeongChange(nextPyeong);
  };

  useEffect(() => {
    if (mode !== 'existing' || loading || !data || data.match !== 'existing') return;
    const key = phone.trim();
    if (!key || autoFilledPhoneRef.current === key) return;
    autoFilledPhoneRef.current = key;
    applyCustomer(data.customer, data.inquiries[0]);
  }, [mode, loading, data, phone]);

  useEffect(() => {
    if (mode === 'new') autoFilledPhoneRef.current = null;
  }, [mode]);

  const handleSaved = (result: CrmIntakeSubmitResult) => {
    if (result.kind === 'inquiry') setLastInquiryId(result.inquiryId);
    onSaved();
    if (mode === 'existing') refresh();
  };

  const openOrderIssue = (inquiryId: string | null) => {
    const base = '/admin/inquiries/order-issue';
    const url = inquiryId
      ? `${base}?pendingInquiryId=${encodeURIComponent(inquiryId)}`
      : base;
    window.open(`${window.location.origin}${url}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <CrmColumn title="접수 · 고객" subtitle="전화 상담 중 고객 정보 등록">
      <div className="space-y-4">
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
          <button
            type="button"
            onClick={() => onModeChange('new')}
            className={`rounded-md px-4 py-2 text-fluid-sm font-medium ${
              mode === 'new' ? 'bg-slate-900 text-white shadow-sm' : 'text-gray-600'
            }`}
          >
            신규
          </button>
          <button
            type="button"
            onClick={() => onModeChange('existing')}
            className={`rounded-md px-4 py-2 text-fluid-sm font-medium ${
              mode === 'existing' ? 'bg-slate-900 text-white shadow-sm' : 'text-gray-600'
            }`}
          >
            기존
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-fluid-xs font-medium text-gray-700">연락처</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="010-0000-0000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm tabular-nums"
          />
        </label>

        {mode === 'existing' ? (
          <CrmCustomerHistoryPanel
            data={data}
            loading={loading}
            error={error}
            onSelectInquiry={(row) => {
              onOpenInquiryEdit(row.id);
            }}
            onNewForCustomer={() => {
              if (data?.customer) applyCustomer(data.customer, data.inquiries[0]);
            }}
          />
        ) : null}

        <div className="border-t border-gray-100 pt-3">
          <CrmIntakeForm
            seed={intakeSeed}
            initialFormDraft={initialFormDraft}
            pyeong={pyeong}
            onPyeongChange={onPyeongChange}
            onFormChange={onFormChange}
            onSaved={handleSaved}
            lastInquiryId={lastInquiryId}
            onOpenOrderIssue={openOrderIssue}
          />
        </div>
      </div>
    </CrmColumn>
  );
}
