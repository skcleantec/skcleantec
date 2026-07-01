import type { TelecrmInquiryBriefDto } from '../../../api/telecrm';
import {
  OrderFormCustomAnswers,
  OrderFormTemplateBadge,
} from '../../orderform/OrderFormTemplateInfo';
import { INQUIRY_STATUS_LABELS } from '../../inquiries/inquiriesUiParts';
import {
  effectiveAdminTeamSpecialNotes,
  effectiveCustomerOrderNotes,
} from '../../../utils/inquirySpecialNotesDisplay';
import { formatWon } from '../settings/telecrmSettingsUi';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fmtYmd(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ko-KR');
  } catch {
    return iso.slice(0, 10);
  }
}

function NoteBlock({ title, body }: { title: string; body: string }) {
  if (!body.trim()) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="mb-1 text-fluid-xs font-semibold text-gray-700">{title}</p>
      <p className="whitespace-pre-wrap text-fluid-sm text-gray-800 leading-relaxed">{body}</p>
    </div>
  );
}

export function CrmInquiryBriefPanel({
  inquiry,
  onOpenDetail,
}: {
  inquiry: TelecrmInquiryBriefDto;
  onOpenDetail?: () => void;
}) {
  const of = inquiry.orderForm;
  const customerNotes = effectiveCustomerOrderNotes({
    specialNotes: inquiry.specialNotes,
    orderForm: of
      ? {
          id: 'linked',
          customerSpecialNotes: of.customerSpecialNotes,
          submittedAt: of.submittedAt,
        }
      : null,
  });
  const adminNotes = effectiveAdminTeamSpecialNotes({
    specialNotes: inquiry.specialNotes,
    orderForm: of
      ? {
          id: 'linked',
          customerSpecialNotes: of.customerSpecialNotes,
          submittedAt: of.submittedAt,
        }
      : null,
  });

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-fluid-sm font-semibold text-gray-900">
            {inquiry.customerName}
            {inquiry.nickname ? (
              <span className="ml-1 font-normal text-gray-500">({inquiry.nickname})</span>
            ) : null}
          </p>
          <p className="text-fluid-2xs text-gray-500">
            {INQUIRY_STATUS_LABELS[inquiry.status] ?? inquiry.status} · 접수{' '}
            {fmtDate(inquiry.createdAt)}
          </p>
          {inquiry.orderFormTemplate ? (
            <div className="mt-1">
              <OrderFormTemplateBadge template={inquiry.orderFormTemplate} />
            </div>
          ) : null}
        </div>
        {onOpenDetail ? (
          <button
            type="button"
            onClick={onOpenDetail}
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-fluid-xs text-gray-800 hover:bg-gray-50"
          >
            상세 수정
          </button>
        ) : null}
      </div>

      <dl className="grid gap-1 text-fluid-xs text-gray-700 sm:grid-cols-2">
        <div>
          <dt className="text-gray-500">연락처</dt>
          <dd className="tabular-nums">{inquiry.customerPhone}</dd>
        </div>
        <div>
          <dt className="text-gray-500">주소</dt>
          <dd className="truncate" title={inquiry.address}>
            {inquiry.address || '—'}
          </dd>
        </div>
        {inquiry.areaPyeong ? (
          <div>
            <dt className="text-gray-500">평수</dt>
            <dd>{inquiry.areaPyeong}평</dd>
          </div>
        ) : null}
        {inquiry.preferredDate ? (
          <div>
            <dt className="text-gray-500">희망일</dt>
            <dd>
              {fmtYmd(inquiry.preferredDate)}
              {inquiry.preferredTime ? ` · ${inquiry.preferredTime}` : ''}
            </dd>
          </div>
        ) : null}
      </dl>

      {of ? (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 space-y-1">
          <p className="text-fluid-xs font-semibold text-indigo-900">발주서 금액</p>
          <p className="text-fluid-sm tabular-nums text-indigo-800">
            총 {formatWon(of.totalAmount)} · 예약금 {formatWon(of.depositAmount)} · 잔금{' '}
            {formatWon(of.balanceAmount)}
          </p>
          {of.submittedAt ? (
            <p className="text-[10px] text-indigo-700">제출 {fmtDate(of.submittedAt)}</p>
          ) : (
            <p className="text-[10px] text-indigo-700">미제출 발주서</p>
          )}
          {of.optionNote ? (
            <p className="text-fluid-xs text-indigo-900 whitespace-pre-wrap">{of.optionNote}</p>
          ) : null}
        </div>
      ) : null}

      <NoteBlock title="접수 메모" body={inquiry.memo ?? ''} />
      <NoteBlock title="고객 특이사항 (발주서)" body={customerNotes} />
      <NoteBlock title="관리·팀 안내" body={adminNotes} />
      <NoteBlock title="클레임·C/S 메모" body={inquiry.claimMemo ?? ''} />

      {inquiry.orderFormTemplate && inquiry.orderForm?.customAnswers?.length ? (
        <OrderFormCustomAnswers
          template={inquiry.orderFormTemplate}
          answers={Object.fromEntries(
            inquiry.orderForm.customAnswers.map((a) => [a.key, a.value]),
          )}
          className="text-fluid-xs"
        />
      ) : null}
    </div>
  );
}
