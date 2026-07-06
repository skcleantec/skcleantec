import { useEffect, useState } from 'react';
import type {
  TelecrmCustomerCandidateDto,
  TelecrmCustomerLookupDto,
  TelecrmInquiryBriefDto,
} from '../../../api/telecrm';
import { ORDER_FOLLOWUP_STATUS_LABEL, type OrderFollowupStatus } from '../../../constants/orderFollowupStatus';
import { INQUIRY_STATUS_LABELS } from '../../inquiries/inquiriesUiParts';
import { CrmActionButton, CrmIconSearch, CrmIconUser, CrmSectionLabel } from '../crmUi';
import { CrmInquiryBriefPanel } from './CrmInquiryBriefPanel';
import { formatTelecrmQuoteWon } from '@shared/telecrmConsultationQuote';

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function inquiryStatusLabel(status: string): string {
  return INQUIRY_STATUS_LABELS[status] ?? status;
}

function followupStatusLabel(status: string): string {
  return (ORDER_FOLLOWUP_STATUS_LABEL as Record<string, string>)[status as OrderFollowupStatus] ?? status;
}

function statusChipClass(status: string): string {
  if (status === 'RECEIVED') return 'bg-emerald-100 text-emerald-800';
  if (status === 'ORDER_FORM_PENDING') return 'bg-amber-100 text-amber-900';
  return 'bg-slate-100 text-slate-700';
}

export function CrmCustomerHistoryPanel({
  data,
  loading,
  error,
  onSelectCandidate,
  onSelectInquiry,
  onNewForCustomer,
}: {
  data: TelecrmCustomerLookupDto | null;
  loading: boolean;
  error: string | null;
  onSelectCandidate: (row: TelecrmCustomerCandidateDto) => void;
  onSelectInquiry: (row: TelecrmInquiryBriefDto) => void;
  onNewForCustomer: () => void;
}) {
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.inquiries.length) {
      setSelectedInquiryId(null);
      return;
    }
    setSelectedInquiryId((prev) => {
      if (prev && data.inquiries.some((i) => i.id === prev)) return prev;
      return data.inquiries[0]?.id ?? null;
    });
  }, [data?.inquiries]);

  const selectedInquiry =
    data?.inquiries.find((i) => i.id === selectedInquiryId) ?? data?.inquiries[0] ?? null;

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-fluid-sm text-emerald-700">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
        고객 이력 조회 중…
      </p>
    );
  }
  if (error) {
    return <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-700">{error}</p>;
  }
  if (!data) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-4 text-fluid-sm text-emerald-800">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
          <CrmIconSearch className="h-4 w-4" />
        </span>
        <p>전화번호(4자 이상) 또는 이름(2자 이상)으로 검색하세요.</p>
      </div>
    );
  }

  if (data.match === 'pick') {
    return (
      <div className="space-y-3">
        <p className="text-fluid-sm text-gray-700">
          같은 이름의 고객이 <strong className="text-emerald-800">{data.candidates.length}명</strong> 있습니다. 연락처를
          확인해 선택하세요.
        </p>
        <ul className="max-h-56 space-y-2 overflow-y-auto">
          {data.candidates.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => onSelectCandidate(row)}
                className="group w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-left shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50/60 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-fluid-sm font-medium text-gray-900">
                    <CrmIconUser className="h-4 w-4 text-emerald-500 opacity-80 group-hover:opacity-100" />
                    {row.customerName}
                  </span>
                  <span className="shrink-0 text-fluid-2xs text-gray-500 tabular-nums">{row.customerPhone}</span>
                </div>
                {row.nickname ? <p className="text-fluid-2xs text-gray-500">닉네임: {row.nickname}</p> : null}
                {row.lastAddress ? (
                  <p className="mt-0.5 truncate text-fluid-2xs text-gray-600" title={row.lastAddress}>
                    {row.lastAddress}
                  </p>
                ) : null}
                <p className="mt-1 text-[10px] font-medium text-emerald-700/80">
                  접수 {row.inquiryCount}건 · 최근 {fmtDate(row.latestAt)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (data.match === 'new') {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-teal-50/40 p-4 text-fluid-sm text-emerald-900">
          {data.searchBy === 'name'
            ? '이 이름으로 등록된 이력이 없습니다. 신규 접수를 진행하세요.'
            : '이 연락처로 등록된 이력이 없습니다. 신규 접수를 진행하세요.'}
        </div>
        {data.latestQuote ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-950">
            <p className="font-semibold">저장된 견적 · {fmtDate(data.latestQuote.updatedAt)}</p>
            {data.latestQuote.payload.grandTotalWon != null ? (
              <p className="tabular-nums">{formatTelecrmQuoteWon(data.latestQuote.payload.grandTotalWon)}</p>
            ) : null}
            {data.latestQuote.updatedByName ? (
              <p className="text-amber-800/70">작성: {data.latestQuote.updatedByName}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  const { customer, inquiries, followups, csReports } = data;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 p-3 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <CrmIconUser className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-fluid-sm font-semibold text-gray-900">{customer.name ?? '이름 미확인'}</p>
            <p className="text-fluid-xs tabular-nums text-gray-600">{customer.phone}</p>
            {customer.nickname ? <p className="text-fluid-xs text-gray-600">닉네임: {customer.nickname}</p> : null}
            {customer.lastAddress ? (
              <p className="mt-1 truncate text-fluid-xs text-gray-600" title={customer.lastAddress}>
                최근 주소: {customer.lastAddress}
              </p>
            ) : null}
            <CrmActionButton accent="intake" className="mt-2" onClick={onNewForCustomer}>
              이 고객으로 새 접수
            </CrmActionButton>
          </div>
        </div>
      </div>

      {data.latestQuote ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-950">
          <p className="font-semibold">최근 견적 · {fmtDate(data.latestQuote.updatedAt)}</p>
          {data.latestQuote.payload.grandTotalWon != null ? (
            <p className="tabular-nums">{formatTelecrmQuoteWon(data.latestQuote.payload.grandTotalWon)}</p>
          ) : null}
          {data.latestQuote.updatedByName ? (
            <p className="text-amber-800/70">작성: {data.latestQuote.updatedByName}</p>
          ) : null}
          <p className="mt-0.5 text-amber-800/70">가격 안내 패널에서 불러오기할 수 있습니다.</p>
        </div>
      ) : null}

      {selectedInquiry ? (
        <CrmInquiryBriefPanel inquiry={selectedInquiry} onOpenDetail={() => onSelectInquiry(selectedInquiry)} />
      ) : null}

      {inquiries.length > 0 ? (
        <section>
          <CrmSectionLabel accent="intake">
            접수 이력 ({inquiries.length}) · 선택하면 상담 요약
          </CrmSectionLabel>
          <ul className="max-h-36 space-y-1.5 overflow-y-auto">
            {inquiries.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelectedInquiryId(row.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition-all ${
                    selectedInquiryId === row.id
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-200'
                      : 'border-emerald-100/80 bg-white hover:border-emerald-300 hover:bg-emerald-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-fluid-xs font-medium text-gray-900">{row.customerName}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusChipClass(row.status)}`}
                    >
                      {inquiryStatusLabel(row.status)}
                    </span>
                  </div>
                  <p className="text-fluid-2xs text-gray-500">{fmtDate(row.createdAt)}</p>
                  {row.memo ? (
                    <p className="mt-0.5 line-clamp-1 text-fluid-2xs text-gray-600">{row.memo}</p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {followups.length > 0 ? (
        <section>
          <CrmSectionLabel accent="intake">부재·보류 ({followups.length})</CrmSectionLabel>
          <ul className="max-h-28 space-y-1 overflow-y-auto text-fluid-2xs text-gray-700">
            {followups.map((row) => (
              <li key={row.id} className="rounded-lg border border-amber-100 bg-amber-50/50 px-2 py-1.5">
                <span className="font-semibold text-amber-900">{followupStatusLabel(row.status)}</span>
                <span className="mx-1 text-gray-400">·</span>
                {fmtDate(row.createdAt)}
                {row.memo ? <p className="line-clamp-1 text-gray-600">{row.memo}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {csReports.length > 0 ? (
        <section>
          <CrmSectionLabel accent="intake">C/S ({csReports.length})</CrmSectionLabel>
          <ul className="max-h-24 space-y-1 overflow-y-auto text-fluid-2xs text-gray-700">
            {csReports.map((row) => (
              <li key={row.id} className="rounded-lg border border-violet-100 bg-violet-50/40 px-2 py-1.5">
                <span className="font-medium text-violet-900">{row.status}</span>
                <span className="mx-1 text-gray-400">·</span>
                {fmtDate(row.createdAt)}
                <p className="line-clamp-2 text-gray-600">{row.content}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
