import { useEffect, useState } from 'react';
import type {
  TelecrmCustomerCandidateDto,
  TelecrmCustomerLookupDto,
  TelecrmInquiryBriefDto,
} from '../../../api/telecrm';
import { ORDER_FOLLOWUP_STATUS_LABEL, type OrderFollowupStatus } from '../../../constants/orderFollowupStatus';
import { INQUIRY_STATUS_LABELS } from '../../inquiries/inquiriesUiParts';
import { CrmInquiryBriefPanel } from './CrmInquiryBriefPanel';

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
    return <p className="text-fluid-sm text-gray-500">고객 이력 조회 중…</p>;
  }
  if (error) {
    return <p className="text-fluid-sm text-red-600">{error}</p>;
  }
  if (!data) {
    return (
      <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-fluid-sm text-gray-500">
        전화번호(4자 이상) 또는 이름(2자 이상)으로 검색하세요.
      </p>
    );
  }

  if (data.match === 'pick') {
    return (
      <div className="space-y-3">
        <p className="text-fluid-sm text-gray-700">
          같은 이름의 고객이 <strong>{data.candidates.length}명</strong> 있습니다. 연락처를 확인해
          선택하세요.
        </p>
        <ul className="space-y-2 max-h-56 overflow-y-auto">
          {data.candidates.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => onSelectCandidate(row)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left hover:border-indigo-400 hover:bg-indigo-50/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-fluid-sm font-medium text-gray-900">{row.customerName}</span>
                  <span className="shrink-0 text-fluid-2xs text-gray-500 tabular-nums">
                    {row.customerPhone}
                  </span>
                </div>
                {row.nickname ? (
                  <p className="text-fluid-2xs text-gray-500">닉네임: {row.nickname}</p>
                ) : null}
                {row.lastAddress ? (
                  <p className="mt-0.5 text-fluid-2xs text-gray-600 truncate" title={row.lastAddress}>
                    {row.lastAddress}
                  </p>
                ) : null}
                <p className="mt-1 text-[10px] text-gray-400">
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
      <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-fluid-sm text-gray-500">
        {data.searchBy === 'name'
          ? '이 이름으로 등록된 이력이 없습니다. 신규 접수를 진행하세요.'
          : '이 연락처로 등록된 이력이 없습니다. 신규 접수를 진행하세요.'}
      </p>
    );
  }

  const { customer, inquiries, followups, csReports } = data;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
        <p className="text-fluid-sm font-semibold text-gray-900">{customer.name ?? '이름 미확인'}</p>
        <p className="text-fluid-xs text-gray-600 tabular-nums">{customer.phone}</p>
        {customer.nickname ? (
          <p className="text-fluid-xs text-gray-600">닉네임: {customer.nickname}</p>
        ) : null}
        {customer.lastAddress ? (
          <p className="mt-1 text-fluid-xs text-gray-600 truncate" title={customer.lastAddress}>
            최근 주소: {customer.lastAddress}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onNewForCustomer}
          className="mt-2 text-fluid-xs font-medium text-indigo-700 hover:underline"
        >
          이 고객으로 새 접수
        </button>
      </div>

      {selectedInquiry ? (
        <CrmInquiryBriefPanel
          inquiry={selectedInquiry}
          onOpenDetail={() => onSelectInquiry(selectedInquiry)}
        />
      ) : null}

      {inquiries.length > 0 ? (
        <section>
          <h3 className="mb-1.5 text-fluid-xs font-semibold text-gray-700">
            접수 이력 ({inquiries.length})
            <span className="ml-1 font-normal text-gray-500">· 선택하면 상담 요약</span>
          </h3>
          <ul className="space-y-1.5 max-h-36 overflow-y-auto">
            {inquiries.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelectedInquiryId(row.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    selectedInquiryId === row.id
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-gray-200 bg-white hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-fluid-xs font-medium text-gray-900 truncate">
                      {row.customerName}
                    </span>
                    <span className="shrink-0 text-fluid-2xs text-sky-800">
                      {inquiryStatusLabel(row.status)}
                    </span>
                  </div>
                  <p className="text-fluid-2xs text-gray-500">{fmtDate(row.createdAt)}</p>
                  {row.memo ? (
                    <p className="mt-0.5 text-fluid-2xs text-gray-600 line-clamp-1">{row.memo}</p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {followups.length > 0 ? (
        <section>
          <h3 className="mb-1.5 text-fluid-xs font-semibold text-gray-700">부재·보류 ({followups.length})</h3>
          <ul className="space-y-1 max-h-28 overflow-y-auto text-fluid-2xs text-gray-700">
            {followups.map((row) => (
              <li key={row.id} className="rounded border border-gray-100 px-2 py-1.5">
                <span className="font-medium">{followupStatusLabel(row.status)}</span>
                <span className="text-gray-400 mx-1">·</span>
                {fmtDate(row.createdAt)}
                {row.memo ? <p className="text-gray-600 line-clamp-1">{row.memo}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {csReports.length > 0 ? (
        <section>
          <h3 className="mb-1.5 text-fluid-xs font-semibold text-gray-700">C/S ({csReports.length})</h3>
          <ul className="space-y-1 max-h-24 overflow-y-auto text-fluid-2xs text-gray-700">
            {csReports.map((row) => (
              <li key={row.id} className="rounded border border-gray-100 px-2 py-1.5">
                {row.status} · {fmtDate(row.createdAt)}
                <p className="text-gray-600 line-clamp-2">{row.content}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
