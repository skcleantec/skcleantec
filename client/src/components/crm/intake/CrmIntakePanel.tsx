import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  TelecrmCustomerCandidateDto,
  TelecrmCustomerLookupDto,
  TelecrmInquiryBriefDto,
} from '../../../api/telecrm';
import type { CrmIntakeFormSnapshot } from '../../../utils/crmIntakeDraft';
import type { TelecrmConsultationQuotePayload } from '@shared/telecrmConsultationQuote';
import type { CrmIntakeSubmitResult } from './crmIntakeSubmit';
import { CrmColumn } from '../layout/CrmShell';
import { CrmIconIntake, CrmIconPhone, CrmIconSearch, CrmSegment, CrmSegmentItem, crmFieldCompactClass } from '../crmUi';
import { telecrmCall, isTelecrmNativeApp, telecrmDispatchNotice } from '../../../utils/telecrmNativeBridge';
import { CrmIntakeForm } from './CrmIntakeForm';
import type { CrmIntakeKind } from './crmIntakeSubmit';
import { CrmCustomerHistoryPanel } from '../customer/CrmCustomerHistoryPanel';
import { CrmCallMemoSection } from '../memo/CrmCallMemoPanel';
import {
  useCrmCustomerLookup,
  type CrmCustomerSearchMode,
} from '../../../hooks/useCrmCustomerLookup';

export type CrmCustomerMode = 'new' | 'existing';

function CrmPhoneField({
  label,
  value,
  onChange,
  onClear,
  canDial,
  onCall,
  callLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  canDial: boolean;
  onCall: () => void;
  callLabel: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-emerald-800">{label}</span>
        {value.trim() ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600"
          >
            연락처 지우기
          </button>
        ) : null}
      </div>
      <div className="flex gap-1.5">
        <input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="010-0000-0000"
          className={`${crmFieldCompactClass} min-w-0 flex-1 tabular-nums`}
        />
        {canDial ? (
          <button
            type="button"
            onClick={onCall}
            className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
          >
            {callLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

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
  canSubmitKind,
  permissionsLoading,
  onOpenOrderIssue,
  onDispatchNotice,
  onContextChange,
  formResetKey = 0,
  quotePayload = null,
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
  canSubmitKind: (kind: CrmIntakeKind) => boolean;
  permissionsLoading?: boolean;
  onOpenOrderIssue?: (inquiryId: string | null) => void;
  onDispatchNotice?: (message: string) => void;
  onContextChange?: (ctx: { inquiryId: string | null; customerMatch: 'new' | 'existing' | 'pick' | 'unknown' }) => void;
  formResetKey?: number;
  quotePayload?: TelecrmConsultationQuotePayload | null;
}) {
  const [searchMode, setSearchMode] = useState<CrmCustomerSearchMode>('phone');
  const [nameSearch, setNameSearch] = useState('');
  const searchText = searchMode === 'phone' ? phone : nameSearch;
  const lookupEnabled =
    mode === 'existing' &&
    (searchMode === 'phone' ? phone.trim().length >= 4 : nameSearch.trim().length >= 2);

  const { data, loading, error, refresh, resolveByPhone } = useCrmCustomerLookup(
    searchMode,
    searchText,
    lookupEnabled,
  );
  const [lastInquiryId, setLastInquiryId] = useState<string | null>(null);
  const [formSeed, setFormSeed] = useState({
    customerName: '',
    nickname: '',
    phone: '',
    memo: '',
    address: '',
  });
  const autoFilledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (skipAutoFillPhone) autoFilledKeyRef.current = skipAutoFillPhone;
  }, [skipAutoFillPhone]);

  useEffect(() => {
    if (lookupRefreshKey > 0 && mode === 'existing') refresh();
  }, [lookupRefreshKey, mode, refresh]);

  useEffect(() => {
    if (mode === 'new') {
      autoFilledKeyRef.current = null;
      setNameSearch('');
      setFormSeed({ customerName: '', nickname: '', phone: '', memo: '', address: '' });
      onCustomerNameChange('');
      onPyeongChange('');
      setLastInquiryId(null);
    }
  }, [mode, formResetKey, onCustomerNameChange, onPyeongChange]);

  const activeInquiryId = lastInquiryId ?? data?.inquiries?.[0]?.id ?? null;
  const activeCustomerMatch: 'new' | 'existing' | 'pick' | 'unknown' =
    mode === 'new' ? 'new' : data?.match === 'pick' ? 'pick' : data?.match === 'existing' ? 'existing' : 'unknown';

  useEffect(() => {
    onContextChange?.({ inquiryId: activeInquiryId, customerMatch: activeCustomerMatch });
  }, [activeInquiryId, activeCustomerMatch, onContextChange]);

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
    latestInquiry?: TelecrmInquiryBriefDto,
  ) => {
    setFormSeed({
      customerName: customer.name ?? '',
      nickname: customer.nickname ?? '',
      phone: customer.phone,
      memo: '',
      address: customer.lastAddress ?? latestInquiry?.address ?? '',
    });
    onPhoneChange(customer.phone);
    onCustomerNameChange(customer.name ?? '');
    const nextPyeong = formatPyeongValue(latestInquiry?.areaPyeong);
    if (nextPyeong) onPyeongChange(nextPyeong);
  };

  useEffect(() => {
    if (mode !== 'existing' || loading || !data || data.match !== 'existing') return;
    const key = `${searchMode}:${data.customer.phone.trim()}`;
    if (!key || autoFilledKeyRef.current === key) return;
    autoFilledKeyRef.current = key;
    applyCustomer(data.customer, data.inquiries[0]);
  }, [mode, loading, data, searchMode]);

  const handleSelectCandidate = (row: TelecrmCustomerCandidateDto) => {
    autoFilledKeyRef.current = null;
    onPhoneChange(row.customerPhone);
    setSearchMode('phone');
    void resolveByPhone(row.customerPhone);
  };

  const handleSaved = (result: CrmIntakeSubmitResult) => {
    if (result.kind === 'inquiry') setLastInquiryId(result.inquiryId);
    onSaved();
    if (mode === 'existing') refresh();
  };

  const openOrderIssue = (inquiryId: string | null) => {
    if (onOpenOrderIssue) {
      onOpenOrderIssue(inquiryId);
      return;
    }
    const base = '/admin/inquiries/order-issue';
    const url = inquiryId
      ? `${base}?pendingInquiryId=${encodeURIComponent(inquiryId)}`
      : base;
    window.open(`${window.location.origin}${url}`, '_blank', 'noopener,noreferrer');
  };

  const dialPhone = phone.trim();
  const canDial = dialPhone.replace(/\D/g, '').length >= 8;

  const handleCall = async () => {
    if (!canDial) return;
    const result = await telecrmCall(dialPhone, {
      customerMatch: activeCustomerMatch,
      inquiryId: activeInquiryId ?? undefined,
    });
    const notice = telecrmDispatchNotice(result, 'call');
    if (notice) onDispatchNotice?.(notice);
  };

  const switchMode = (next: CrmCustomerMode) => {
    if (next === 'new' && mode === 'existing') {
      setFormSeed({ customerName: '', nickname: '', phone: '', memo: '', address: '' });
      onCustomerNameChange('');
      onPyeongChange('');
      setLastInquiryId(null);
      autoFilledKeyRef.current = null;
    }
    onModeChange(next);
  };

  return (
    <CrmColumn accent="intake" title="접수 · 고객" subtitle="연락처 · 처리 구분">
      <div className="space-y-2.5">
        <CrmSegment accent="intake" className="w-full flex flex-wrap">
          <CrmSegmentItem
            accent="intake"
            compact
            active={mode === 'new'}
            onClick={() => switchMode('new')}
            icon={<CrmIconIntake className="h-3 w-3" />}
          >
            신규
          </CrmSegmentItem>
          <CrmSegmentItem
            accent="intake"
            compact
            active={mode === 'existing'}
            onClick={() => switchMode('existing')}
            icon={<CrmIconSearch className="h-3 w-3" />}
          >
            기존
          </CrmSegmentItem>
        </CrmSegment>

        {mode === 'existing' ? (
          <>
            <CrmSegment accent="intake" className="w-full flex flex-wrap">
              <CrmSegmentItem
                accent="intake"
                compact
                active={searchMode === 'phone'}
                onClick={() => setSearchMode('phone')}
                icon={<CrmIconPhone className="h-3 w-3" />}
              >
                전화번호
              </CrmSegmentItem>
              <CrmSegmentItem
                accent="intake"
                compact
                active={searchMode === 'name'}
                onClick={() => setSearchMode('name')}
                icon={<CrmIconSearch className="h-3 w-3" />}
              >
                이름
              </CrmSegmentItem>
            </CrmSegment>

            {searchMode === 'phone' ? (
              <CrmPhoneField
                label="연락처 검색"
                value={phone}
                onChange={onPhoneChange}
                onClear={() => onPhoneChange('')}
                canDial={canDial}
                onCall={() => void handleCall()}
                callLabel={isTelecrmNativeApp() ? '앱 통화' : '통화'}
              />
            ) : (
              <label className="block space-y-0.5">
                <span className="text-[11px] font-semibold text-emerald-800">고객 이름 검색</span>
                <input
                  type="text"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  placeholder="홍길동 (2자 이상)"
                  className={crmFieldCompactClass}
                />
              </label>
            )}

            <CrmCustomerHistoryPanel
              data={lookupEnabled ? data : null}
              loading={lookupEnabled && loading}
              error={error}
              onSelectCandidate={handleSelectCandidate}
              onSelectInquiry={(row) => onOpenInquiryEdit(row.id)}
              onNewForCustomer={() => {
                if (data?.customer) applyCustomer(data.customer, data.inquiries[0]);
              }}
              onDispatchNotice={onDispatchNotice}
            />
          </>
        ) : (
          <CrmPhoneField
            label="연락처"
            value={phone}
            onChange={onPhoneChange}
            onClear={() => onPhoneChange('')}
            canDial={canDial}
            onCall={() => void handleCall()}
            callLabel={isTelecrmNativeApp() ? '앱 통화' : '통화'}
          />
        )}

        <div className="border-t border-emerald-100/80 pt-2">
          <CrmIntakeForm
            seed={intakeSeed}
            initialFormDraft={initialFormDraft}
            phone={phone}
            pyeong={pyeong}
            onPyeongChange={onPyeongChange}
            onFormChange={onFormChange}
            onSaved={handleSaved}
            lastInquiryId={lastInquiryId}
            onOpenOrderIssue={openOrderIssue}
            canSubmitKind={canSubmitKind}
            permissionsLoading={permissionsLoading}
            formResetKey={formResetKey}
            quotePayload={quotePayload}
          />
        </div>

        <CrmCallMemoSection phone={phone} inquiryId={activeInquiryId} resetKey={formResetKey} />
      </div>
    </CrmColumn>
  );
}
