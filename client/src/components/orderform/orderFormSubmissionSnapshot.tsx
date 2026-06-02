import type { OrderFormCustomerSubmissionSnapshotV1 } from '../../api/orderform';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { ORDER_FORM_PROFESSIONAL_OPTIONS_SHORT_LABEL } from '../../constants/orderFormProfessionalOptions';
import { ORDER_TIME_SLOT_OPTIONS } from '../../constants/orderFormSchedule';

export function slotLabelForOrderForm(v: string): string {
  return ORDER_TIME_SLOT_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

function renderSnapshotAnswerValue(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ');
  if (typeof v === 'boolean') return v ? '예' : '아니오';
  return String(v);
}

export function isOrderFormSubmissionSnapshotV1(x: unknown): x is OrderFormCustomerSubmissionSnapshotV1 {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    o.version === 1 &&
    typeof o.capturedAt === 'string' &&
    typeof o.fields === 'object' &&
    o.fields !== null &&
    typeof o.issuedSummary === 'object' &&
    o.issuedSummary !== null
  );
}

export function OrderFormSnapshotRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-gray-100 py-2 text-fluid-sm sm:grid-cols-[7.5rem_1fr] sm:gap-3">
      <div className="shrink-0 text-fluid-xs font-medium text-gray-500 sm:text-fluid-sm">{label}</div>
      <div className="min-w-0 whitespace-pre-wrap break-words text-gray-900">{children}</div>
    </div>
  );
}

export function OrderFormSubmissionSnapshotContent(props: {
  snapshot: unknown;
  submittedAt?: string | null;
}) {
  const { snapshot, submittedAt } = props;

  if (!isOrderFormSubmissionSnapshotV1(snapshot)) {
    return (
      <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded border border-amber-200 bg-amber-50/50 p-3 font-mono text-fluid-2xs text-gray-800">
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    );
  }

  const tpl = snapshot.template ?? null;
  const tplAnswers = (snapshot.templateAnswers ?? []).filter(
    (a) => a && String(renderSnapshotAnswerValue(a.value)).trim() !== ''
  );

  return (
    <div className="space-y-4">
      {tpl ? (
        <section className="rounded-lg border border-gray-100 bg-gray-50/80 p-3">
          <h3 className="mb-1 text-fluid-xs font-semibold uppercase tracking-wide text-gray-500">발주서 양식</h3>
          <p className="text-fluid-sm font-medium text-gray-900">
            {tpl.icon ? `${tpl.icon} ` : ''}
            {tpl.title}
          </p>
        </section>
      ) : null}

      {tplAnswers.length > 0 ? (
        <section>
          <h3 className="mb-1 text-fluid-sm font-semibold text-gray-900">추가 정보</h3>
          <div className="rounded-lg border border-gray-200 bg-white px-3">
            {tplAnswers.map((a, i) => (
              <OrderFormSnapshotRow key={`${a.fieldKey}-${i}`} label={a.label}>
                {renderSnapshotAnswerValue(a.value)}
              </OrderFormSnapshotRow>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-gray-100 bg-gray-50/80 p-3">
        <h3 className="mb-2 text-fluid-xs font-semibold uppercase tracking-wide text-gray-500">제출 시각</h3>
        <p className="text-fluid-sm text-gray-800 tabular-nums">
          {submittedAt
            ? formatDateCompactWithWeekday(submittedAt)
            : new Date(snapshot.capturedAt).toLocaleString('ko-KR', {
                timeZone: 'Asia/Seoul',
                dateStyle: 'medium',
                timeStyle: 'medium',
              })}
        </p>
      </section>

      <section>
        <h3 className="mb-1 text-fluid-sm font-semibold text-gray-900">입력 내용</h3>
        <div className="rounded-lg border border-gray-200 bg-white px-3">
          <OrderFormSnapshotRow label="성함">{snapshot.fields.customerName}</OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="연락처">{snapshot.fields.customerPhone}</OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="보조 연락처">
            {snapshot.fields.customerPhone2?.trim() ? snapshot.fields.customerPhone2 : '—'}
          </OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="주소">{snapshot.fields.address}</OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="상세주소">
            {snapshot.fields.addressDetail?.trim() ? snapshot.fields.addressDetail : '—'}
          </OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="건축물 유형">{snapshot.fields.propertyType}</OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="공급면적 (분양평수)">
            {snapshot.fields.areaBasis === '공급' &&
            snapshot.fields.areaPyeong != null &&
            Number.isFinite(snapshot.fields.areaPyeong)
              ? `${snapshot.fields.areaPyeong}평`
              : snapshot.fields.areaBasis !== '공급' &&
                  snapshot.fields.areaBasis !== '전용' &&
                  snapshot.fields.areaPyeong != null &&
                  Number.isFinite(snapshot.fields.areaPyeong)
                ? `${snapshot.fields.areaPyeong}평 (레거시)`
                : '—'}
          </OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="전용면적 (실제 내 집 공간)">
            {snapshot.fields.areaBasis === '전용' &&
            snapshot.fields.areaPyeong != null &&
            Number.isFinite(snapshot.fields.areaPyeong)
              ? `${snapshot.fields.areaPyeong}평`
              : snapshot.fields.areaBasis === '전용' &&
                  snapshot.fields.exclusiveAreaSqm != null &&
                  Number.isFinite(snapshot.fields.exclusiveAreaSqm)
                ? `${Number(snapshot.fields.exclusiveAreaSqm).toLocaleString('ko-KR')}㎡ (과거 제출)`
                : snapshot.fields.areaBasis === '전용'
                  ? '입력 없음'
                  : '—'}
          </OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="방">{snapshot.fields.roomCount ?? '—'}</OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="발코니">{snapshot.fields.balconyCount ?? '—'}</OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="화장실">{snapshot.fields.bathroomCount ?? '—'}</OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="주방">{snapshot.fields.kitchenCount ?? '—'}</OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="건축 형태">
            {snapshot.fields.buildingType?.trim() ? snapshot.fields.buildingType : '—'}
          </OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="입주일">
            {snapshot.fields.moveInDateUndecided
              ? '미정'
              : snapshot.fields.moveInDate?.trim()
                ? formatDateCompactWithWeekday(snapshot.fields.moveInDate)
                : '—'}
          </OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="청소 희망일">
            {formatDateCompactWithWeekday(snapshot.fields.preferredDate)}
          </OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="시간대">{slotLabelForOrderForm(snapshot.fields.preferredTime)}</OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="구체적 시각">
            {snapshot.fields.preferredTimeDetail?.trim() ? snapshot.fields.preferredTimeDetail : '—'}
          </OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="특이사항">
            {snapshot.fields.specialNotes?.trim() ? snapshot.fields.specialNotes : '—'}
          </OrderFormSnapshotRow>
          <div className="border-b border-gray-100 py-2">
            <div className="text-fluid-xs font-medium text-gray-500 sm:mb-1">
              {ORDER_FORM_PROFESSIONAL_OPTIONS_SHORT_LABEL}
            </div>
            {snapshot.fields.professionalOptionLabels.length === 0 ? (
              <span className="text-fluid-sm text-gray-700">선택 없음</span>
            ) : (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-fluid-sm text-gray-900">
                {snapshot.fields.professionalOptionLabels.map((t, i) => (
                  <li key={`${t}-${i}`}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-fluid-sm font-semibold text-gray-900">금액 안내</h3>
        <div className="rounded-lg border border-gray-200 bg-white px-3">
          <OrderFormSnapshotRow label="총액">
            {snapshot.issuedSummary.totalAmount.toLocaleString('ko-KR')}원
          </OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="예약금">
            {snapshot.issuedSummary.depositAmount.toLocaleString('ko-KR')}원
          </OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="잔금">
            {snapshot.issuedSummary.balanceAmount.toLocaleString('ko-KR')}원
          </OrderFormSnapshotRow>
          <OrderFormSnapshotRow label="추가 옵션 안내">
            {snapshot.issuedSummary.optionNote?.trim() ? snapshot.issuedSummary.optionNote : '—'}
          </OrderFormSnapshotRow>
        </div>
      </section>
    </div>
  );
}
