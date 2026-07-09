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
import { CrmIconIntake, CrmIconPhone, CrmIconReset, CrmIconSearch, CrmSegment, CrmSegmentItem, crmFieldCompactClass } from '../crmUi';
import { telecrmCall, isTelecrmNativeApp, telecrmDispatchNotice } from '../../../utils/telecrmNativeBridge';
import { CrmIntakeForm } from './CrmIntakeForm';
import type { CrmIntakeKind } from './crmIntakeSubmit';
import { CrmCustomerHistoryPanel } from '../customer/CrmCustomerHistoryPanel';
import { CrmCallMemoSection } from '../memo/CrmCallMemoPanel';
import {
  useCrmCustomerLookup,
  type CrmCustomerSearchMode,
} from '../../../hooks/useCrmCustomerLookup';
import { getToken } from '../../../stores/auth';
import {
  noticeForSoomgoFollowupAutoSend,
  trySoomgoFollowupAutoMessage,
} from '../../../utils/soomgoFollowupAutoSend';

export type CrmCustomerMode = 'new' | 'existing';

function CrmPhoneField({
  label,
  value,
  onChange,
  onClear,
  canDial,
  onCall,
  callLabel,
  highlight = false,
  phoneUnknown = false,
  onPhoneUnknownChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  canDial: boolean;
  onCall: () => void;
  callLabel: string;
  highlight?: boolean;
  phoneUnknown?: boolean;
  onPhoneUnknownChange?: (checked: boolean) => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-emerald-800">{label}</span>
        <div className="flex flex-wrap items-center gap-2">
          {onPhoneUnknownChange ? (
            <label className="flex cursor-pointer items-center gap-1 text-[10px] font-medium text-slate-600">
              <input
                type="checkbox"
                checked={phoneUnknown}
                onChange={(e) => onPhoneUnknownChange(e.target.checked)}
                className="rounded border-slate-300"
              />
              전화번호 없음
            </label>
          ) : null}
          {value.trim() && !phoneUnknown ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            >
              연락처 지우기
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex gap-1.5">
        <input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={phoneUnknown ? '전화번호 없음' : '010-0000-0000'}
          disabled={phoneUnknown}
          className={`${crmFieldCompactClass} min-w-0 flex-1 tabular-nums disabled:bg-slate-100 disabled:text-slate-500 ${highlight ? 'ring-2 ring-sky-400/80 ring-offset-1' : ''}`}
        />
        {canDial && !phoneUnknown ? (
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
  phoneUnknown,
  onPhoneUnknownChange,
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
  soomgoImportBanner = null,
  soomgoImportFlashKey = 0,
  onIntakeReset,
  operatingCompanyId = null,
}: {
  mode: CrmCustomerMode;
  onModeChange: (m: CrmCustomerMode) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  phoneUnknown: boolean;
  onPhoneUnknownChange: (v: boolean) => void;
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
  soomgoImportBanner?: string | null;
  soomgoImportFlashKey?: number;
  onIntakeReset?: () => void;
  operatingCompanyId?: string | null;
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
    operatingCompanyId,
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
    if (mode !== 'new') return;
    autoFilledKeyRef.current = null;
    setNameSearch('');
    setFormSeed({ customerName: '', nickname: '', phone: '', memo: '', address: '' });
    setLastInquiryId(null);
  }, [mode]);

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
    if (result.kind === 'followup') {
      const token = getToken();
      if (!token) return;
      void trySoomgoFollowupAutoMessage(token, result.intakeKind, {
        customerName: result.customerName,
        nickname: result.nickname,
      }).then((auto) => {
        const notice = noticeForSoomgoFollowupAutoSend(auto);
        if (notice) onDispatchNotice?.(notice);
      });
    }
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
    <CrmColumn
      accent="intake"
      title="접수 · 고객"
      subtitle="연락처 · 처리 구분"
      headerAction={
        onIntakeReset ? (
          <button
            type="button"
            onClick={onIntakeReset}
            title="접수란 초기화"
            aria-label="접수란 초기화"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-500 shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          >
            <CrmIconReset className="h-4 w-4" />
          </button>
        ) : null
      }
    >
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
            onChange={(v) => {
              onPhoneChange(v);
              if (v.trim()) onPhoneUnknownChange(false);
            }}
            onClear={() => onPhoneChange('')}
            canDial={canDial}
            onCall={() => void handleCall()}
            callLabel={isTelecrmNativeApp() ? '앱 통화' : '통화'}
            highlight={soomgoImportFlashKey > 0 && phone.trim().length > 0}
            phoneUnknown={phoneUnknown}
            onPhoneUnknownChange={(checked) => {
              onPhoneUnknownChange(checked);
              if (checked) onPhoneChange('');
            }}
          />
        )}

        <div className="border-t border-emerald-100/80 pt-2">
          {soomgoImportBanner ? (
            <div className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2 text-[11px] leading-snug text-sky-950">
              <p className="font-semibold text-sky-900">숨고에서 가져온 정보</p>
              <p className="mt-0.5 whitespace-pre-wrap">{soomgoImportBanner}</p>
            </div>
          ) : null}
          <CrmIntakeForm
            seed={intakeSeed}
            initialFormDraft={initialFormDraft}
            phone={phone}
            phoneUnknown={phoneUnknown}
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
            soomgoImportFlashKey={soomgoImportFlashKey}
            operatingCompanyId={operatingCompanyId}
          />
        </div>

        <CrmCallMemoSection phone={phone} inquiryId={activeInquiryId} resetKey={formResetKey} />
      </div>
    </CrmColumn>
  );
}
