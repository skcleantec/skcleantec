import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  TelecrmCustomerCandidateDto,
  TelecrmCustomerLookupDto,
  TelecrmInquiryBriefDto,
} from '../../../api/telecrm';
import type { CrmIntakeFormSnapshot } from '../../../utils/crmIntakeDraft';
import type { CrmIntakeSubmitResult } from './crmIntakeSubmit';
import { CrmColumn } from '../layout/CrmShell';
import { CrmIntakeForm } from './CrmIntakeForm';
import type { CrmIntakeKind } from './crmIntakeSubmit';
import { CrmCustomerHistoryPanel } from '../customer/CrmCustomerHistoryPanel';
import {
  useCrmCustomerLookup,
  type CrmCustomerSearchMode,
} from '../../../hooks/useCrmCustomerLookup';

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
  canSubmitKind,
  permissionsLoading,
  onOpenOrderIssue,
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
    }
  }, [mode]);

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

        {mode === 'existing' ? (
          <>
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
              <button
                type="button"
                onClick={() => setSearchMode('phone')}
                className={`rounded-md px-3 py-1.5 text-fluid-xs font-medium ${
                  searchMode === 'phone' ? 'bg-slate-900 text-white' : 'text-gray-600'
                }`}
              >
                전화번호
              </button>
              <button
                type="button"
                onClick={() => setSearchMode('name')}
                className={`rounded-md px-3 py-1.5 text-fluid-xs font-medium ${
                  searchMode === 'name' ? 'bg-slate-900 text-white' : 'text-gray-600'
                }`}
              >
                이름
              </button>
            </div>

            {searchMode === 'phone' ? (
              <label className="block space-y-1">
                <span className="text-fluid-xs font-medium text-gray-700">연락처 검색</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => onPhoneChange(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm tabular-nums"
                />
              </label>
            ) : (
              <label className="block space-y-1">
                <span className="text-fluid-xs font-medium text-gray-700">고객 이름 검색</span>
                <input
                  type="text"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  placeholder="홍길동 (2자 이상)"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
                />
                <p className="text-[10px] text-gray-500">동명이인이 있으면 연락처 목록에서 선택합니다.</p>
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
            />
          </>
        ) : (
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
        )}

        <div className="border-t border-gray-100 pt-3">
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
          />
        </div>
      </div>
    </CrmColumn>
  );
}
