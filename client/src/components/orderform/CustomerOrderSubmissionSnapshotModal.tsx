import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import {
  getOrderFormCustomerSubmission,
  type OrderFormCustomerSubmissionSnapshotV1,
} from '../../api/orderform';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { ORDER_TIME_SLOT_OPTIONS } from '../../constants/orderFormSchedule';

function slotLabel(v: string): string {
  return ORDER_TIME_SLOT_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

function isSnapshotV1(x: unknown): x is OrderFormCustomerSubmissionSnapshotV1 {
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

function SnapshotRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-gray-100 py-2 text-fluid-sm sm:grid-cols-[7.5rem_1fr] sm:gap-3">
      <div className="shrink-0 text-fluid-xs font-medium text-gray-500 sm:text-fluid-sm">{label}</div>
      <div className="min-w-0 whitespace-pre-wrap break-words text-gray-900">{children}</div>
    </div>
  );
}

export function CustomerOrderSubmissionSnapshotModal(props: {
  open: boolean;
  onClose: () => void;
  authToken: string | null;
  orderFormId: string | null;
  customerName: string;
}) {
  const { open, onClose, authToken, orderFormId, customerName } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<unknown | null>(null);

  useEffect(() => {
    if (!open || !authToken || !orderFormId) {
      setLoading(false);
      setError(null);
      setSubmittedAt(null);
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSubmittedAt(null);
    setSnapshot(null);
    void getOrderFormCustomerSubmission(authToken, orderFormId)
      .then((r) => {
        if (cancelled) return;
        setSubmittedAt(r.submittedAt);
        setSnapshot(r.snapshot);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, authToken, orderFormId]);

  if (!open || typeof document === 'undefined') return null;

  const root = document.body;

  return createPortal(
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/45"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[min(92vh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl sm:max-w-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-submission-snapshot-title"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-4 pr-14">
          <h2 id="order-submission-snapshot-title" className="text-base font-semibold text-gray-900">
            고객 제출 발주서 원본
          </h2>
          <p className="mt-1 text-fluid-xs text-gray-600">{customerName}</p>
          {submittedAt ? (
            <p className="mt-0.5 text-fluid-2xs text-gray-500 tabular-nums">
              제출 시각 {formatDateCompactWithWeekday(submittedAt)}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {!authToken ? (
            <p className="text-fluid-sm text-gray-600">로그인이 필요합니다.</p>
          ) : loading ? (
            <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
          ) : error ? (
            <p className="text-fluid-sm text-red-600">{error}</p>
          ) : !submittedAt ? (
            <p className="text-fluid-sm text-gray-600">아직 제출되지 않은 발주서입니다.</p>
          ) : snapshot == null ? (
            <p className="text-fluid-sm text-gray-600">
              저장된 제출 원본이 없습니다. 과거에 제출된 건이거나 DB 마이그레이션 이전 데이터일 수 있습니다. 접수
              상세의 입력값을 참고해 주세요.
            </p>
          ) : isSnapshotV1(snapshot) ? (
            <div className="space-y-4">
              <section className="rounded-lg border border-gray-100 bg-gray-50/80 p-3">
                <h3 className="mb-2 text-fluid-xs font-semibold uppercase tracking-wide text-gray-500">
                  저장 시각 (서버)
                </h3>
                <p className="text-fluid-sm text-gray-800 tabular-nums">
                  {new Date(snapshot.capturedAt).toLocaleString('ko-KR', {
                    timeZone: 'Asia/Seoul',
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  })}
                </p>
              </section>

              <section>
                <h3 className="mb-1 text-fluid-sm font-semibold text-gray-900">고객 입력</h3>
                <div className="rounded-lg border border-gray-200 bg-white px-3">
                  <SnapshotRow label="성함">{snapshot.fields.customerName}</SnapshotRow>
                  <SnapshotRow label="연락처">{snapshot.fields.customerPhone}</SnapshotRow>
                  <SnapshotRow label="보조 연락처">{snapshot.fields.customerPhone2}</SnapshotRow>
                  <SnapshotRow label="주소">{snapshot.fields.address}</SnapshotRow>
                  <SnapshotRow label="상세주소">
                    {snapshot.fields.addressDetail?.trim() ? snapshot.fields.addressDetail : '—'}
                  </SnapshotRow>
                  <SnapshotRow label="건축물 유형">{snapshot.fields.propertyType}</SnapshotRow>
                  <SnapshotRow label="공급면적 (분양평수)">
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
                  </SnapshotRow>
                  <SnapshotRow label="전용면적 (실제 내 집 공간)">
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
                  </SnapshotRow>
                  <SnapshotRow label="방">{snapshot.fields.roomCount ?? '—'}</SnapshotRow>
                  <SnapshotRow label="발코니">{snapshot.fields.balconyCount ?? '—'}</SnapshotRow>
                  <SnapshotRow label="화장실">{snapshot.fields.bathroomCount ?? '—'}</SnapshotRow>
                  <SnapshotRow label="주방">{snapshot.fields.kitchenCount ?? '—'}</SnapshotRow>
                  <SnapshotRow label="건축 형태">
                    {snapshot.fields.buildingType?.trim() ? snapshot.fields.buildingType : '—'}
                  </SnapshotRow>
                  <SnapshotRow label="입주일">
                    {snapshot.fields.moveInDateUndecided
                      ? '미정'
                      : snapshot.fields.moveInDate?.trim()
                        ? formatDateCompactWithWeekday(snapshot.fields.moveInDate)
                        : '—'}
                  </SnapshotRow>
                  <SnapshotRow label="청소 희망일">
                    {formatDateCompactWithWeekday(snapshot.fields.preferredDate)}
                  </SnapshotRow>
                  <SnapshotRow label="시간대">{slotLabel(snapshot.fields.preferredTime)}</SnapshotRow>
                  <SnapshotRow label="구체적 시각">
                    {snapshot.fields.preferredTimeDetail?.trim() ? snapshot.fields.preferredTimeDetail : '—'}
                  </SnapshotRow>
                  <SnapshotRow label="특이사항">
                    {snapshot.fields.specialNotes?.trim() ? snapshot.fields.specialNotes : '—'}
                  </SnapshotRow>
                  <div className="border-b border-gray-100 py-2">
                    <div className="text-fluid-xs font-medium text-gray-500 sm:mb-1">전문 시공 옵션</div>
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
                <h3 className="mb-1 text-fluid-sm font-semibold text-gray-900">발급 시 금액·메모</h3>
                <div className="rounded-lg border border-gray-200 bg-white px-3">
                  <SnapshotRow label="총액">
                    {snapshot.issuedSummary.totalAmount.toLocaleString('ko-KR')}원
                  </SnapshotRow>
                  <SnapshotRow label="예약금">
                    {snapshot.issuedSummary.depositAmount.toLocaleString('ko-KR')}원
                  </SnapshotRow>
                  <SnapshotRow label="잔금">
                    {snapshot.issuedSummary.balanceAmount.toLocaleString('ko-KR')}원
                  </SnapshotRow>
                  <SnapshotRow label="추가 옵션 안내">
                    {snapshot.issuedSummary.optionNote?.trim() ? snapshot.issuedSummary.optionNote : '—'}
                  </SnapshotRow>
                </div>
              </section>
            </div>
          ) : (
            <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded border border-amber-200 bg-amber-50/50 p-3 font-mono text-fluid-2xs text-gray-800">
              {JSON.stringify(snapshot, null, 2)}
            </pre>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-fluid-2xs leading-snug text-gray-600">
            이 내용은 고객이 「제출」을 눌렀을 때 서버에 저장된 확정값입니다. 추후 고객에게 동일 내용을 보내는 기능은
            별도로 연결할 수 있도록 저장해 두었습니다.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>,
    root
  );
}
