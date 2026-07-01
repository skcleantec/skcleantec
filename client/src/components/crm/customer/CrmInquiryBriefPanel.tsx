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
import { CrmActionButton } from '../crmUi';
import { telecrmCall, telecrmSms, isTelecrmNativeApp } from '../../../utils/telecrmNativeBridge';
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

function NoteBlock({ title, body, tint = 'emerald' }: { title: string; body: string; tint?: 'emerald' | 'violet' | 'amber' }) {
  if (!body.trim()) return null;
  const border =
    tint === 'violet' ? 'border-violet-100 bg-violet-50/40' : tint === 'amber' ? 'border-amber-100 bg-amber-50/40' : 'border-emerald-100 bg-white';
  const titleColor =
    tint === 'violet' ? 'text-violet-800' : tint === 'amber' ? 'text-amber-900' : 'text-emerald-800';
  return (
    <div className={`rounded-xl border p-3 shadow-sm ${border}`}>
      <p className={`mb-1 text-fluid-xs font-semibold ${titleColor}`}>{title}</p>
      <p className="whitespace-pre-wrap text-fluid-sm leading-relaxed text-gray-800">{body}</p>
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
    <div className="space-y-3 rounded-xl border border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/20 p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-fluid-sm font-semibold text-gray-900">
            {inquiry.customerName}
            {inquiry.nickname ? (
              <span className="ml-1 font-normal text-gray-500">({inquiry.nickname})</span>
            ) : null}
          </p>
          <p className="text-fluid-2xs text-gray-600">
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
              {INQUIRY_STATUS_LABELS[inquiry.status] ?? inquiry.status}
            </span>
            <span className="ml-1.5">접수 {fmtDate(inquiry.createdAt)}</span>
          </p>
          {inquiry.orderFormTemplate ? (
            <div className="mt-1">
              <OrderFormTemplateBadge template={inquiry.orderFormTemplate} />
            </div>
          ) : null}
        </div>
        {onOpenDetail ? (
          <CrmActionButton accent="intake" onClick={onOpenDetail}>
            상세 수정
          </CrmActionButton>
        ) : null}
        {inquiry.customerPhone ? (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <CrmActionButton
              accent="intake"
              variant="solid"
              onClick={() => void telecrmCall(inquiry.customerPhone, { inquiryId: inquiry.id, customerMatch: 'existing' })}
            >
              {isTelecrmNativeApp() ? '앱 통화' : '통화'}
            </CrmActionButton>
            {inquiry.memo?.trim() ? (
              <CrmActionButton
                accent="script"
                onClick={() =>
                  void telecrmSms(inquiry.customerPhone, inquiry.memo ?? '', {
                    inquiryId: inquiry.id,
                    customerMatch: 'existing',
                  })
                }
              >
                문자
              </CrmActionButton>
            ) : null}
          </div>
        ) : null}
      </div>

      <dl className="grid gap-2 rounded-xl border border-emerald-100/80 bg-white/80 p-3 text-fluid-xs text-gray-700 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/80">연락처</dt>
          <dd className="tabular-nums">{inquiry.customerPhone}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/80">주소</dt>
          <dd className="truncate" title={inquiry.address}>
            {inquiry.address || '—'}
          </dd>
        </div>
        {inquiry.areaPyeong ? (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/80">평수</dt>
            <dd>{inquiry.areaPyeong}평</dd>
          </div>
        ) : null}
        {inquiry.preferredDate ? (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/80">희망일</dt>
            <dd>
              {fmtYmd(inquiry.preferredDate)}
              {inquiry.preferredTime ? ` · ${inquiry.preferredTime}` : ''}
            </dd>
          </div>
        ) : null}
      </dl>

      {of ? (
        <div className="space-y-1 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/50 p-3">
          <p className="text-fluid-xs font-bold text-amber-900">발주서 금액</p>
          <p className="text-fluid-sm tabular-nums font-semibold text-amber-900">
            총 {formatWon(of.totalAmount)} · 예약금 {formatWon(of.depositAmount)} · 잔금{' '}
            {formatWon(of.balanceAmount)}
          </p>
          {of.submittedAt ? (
            <p className="text-[10px] text-amber-800/80">제출 {fmtDate(of.submittedAt)}</p>
          ) : (
            <p className="text-[10px] font-medium text-amber-800">미제출 발주서</p>
          )}
          {of.optionNote ? (
            <p className="whitespace-pre-wrap text-fluid-xs text-amber-950">{of.optionNote}</p>
          ) : null}
        </div>
      ) : null}

      <NoteBlock title="접수 메모" body={inquiry.memo ?? ''} />
      <NoteBlock title="고객 특이사항 (발주서)" body={customerNotes} tint="violet" />
      <NoteBlock title="관리·팀 안내" body={adminNotes} tint="amber" />
      <NoteBlock title="클레임·C/S 메모" body={inquiry.claimMemo ?? ''} tint="violet" />

      {inquiry.orderFormTemplate && inquiry.orderForm?.customAnswers?.length ? (
        <OrderFormCustomAnswers
          template={inquiry.orderFormTemplate}
          answers={Object.fromEntries(inquiry.orderForm.customAnswers.map((a) => [a.key, a.value]))}
          className="text-fluid-xs"
        />
      ) : null}
    </div>
  );
}
