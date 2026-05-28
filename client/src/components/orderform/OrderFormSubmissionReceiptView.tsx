import { useCallback, useEffect, useState } from 'react';
import {
  listOrderFormPhotosByToken,
  type OrderFormConfigPublic,
  type OrderFormPhotoItem,
} from '../../api/orderform';
import {
  ORDER_FORM_CONFIG_DEFAULTS,
  orderFormConfigLine,
} from '../../constants/orderFormConfigDefaults';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { OrderFormSubmissionSnapshotContent } from './orderFormSubmissionSnapshot';

export function OrderFormSubmissionReceiptView(props: {
  token: string;
  customerName: string;
  submittedAt: string;
  inquiryNumber: string | null;
  snapshot: unknown | null;
  formConfig?: OrderFormConfigPublic;
  headerRight?: React.ReactNode;
}) {
  const { token, customerName, submittedAt, inquiryNumber, snapshot, formConfig, headerRight } = props;
  const [photos, setPhotos] = useState<OrderFormPhotoItem[]>([]);
  const [preview, setPreview] = useState<OrderFormPhotoItem | null>(null);

  const successTitle = orderFormConfigLine(
    formConfig?.submitSuccessTitle,
    ORDER_FORM_CONFIG_DEFAULTS.submitSuccessTitle
  );
  const successBody = orderFormConfigLine(
    formConfig?.submitSuccessBody,
    ORDER_FORM_CONFIG_DEFAULTS.submitSuccessBody
  );

  const refreshPhotos = useCallback(async () => {
    try {
      const r = await listOrderFormPhotosByToken(token);
      setPhotos(r.items);
    } catch {
      /* 네트워크 일시 장애 */
    }
  }, [token]);

  useEffect(() => {
    void refreshPhotos();
  }, [refreshPhotos]);

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="max-w-lg mx-auto px-4 py-6 relative">
        {headerRight ? <div className="absolute top-4 right-4">{headerRight}</div> : null}

        <div className="mb-6 pr-16">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">제출 확인서</p>
          <h1 className="mt-1 text-lg font-semibold text-gray-900 whitespace-pre-line">{successTitle}</h1>
          <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">{successBody}</p>
          <p className="mt-3 text-fluid-xs text-gray-500">
            이 링크를 저장해 두시면 제출 내용을 다시 확인할 수 있습니다.
          </p>
        </div>

        <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-fluid-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium text-gray-900">{customerName}</span>
            <span className="text-fluid-xs text-gray-500 tabular-nums">
              {formatDateCompactWithWeekday(submittedAt)} 제출
            </span>
          </div>
          {inquiryNumber ? (
            <p className="mt-2 text-fluid-xs text-gray-600">
              접수번호 <span className="font-medium tabular-nums text-gray-900">{inquiryNumber}</span>
            </p>
          ) : null}
        </div>

        {snapshot == null ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-fluid-sm text-gray-700">
            제출은 완료되었으나 상세 내역을 불러올 수 없습니다. 문의가 필요하면 업체에 연락해 주세요.
          </div>
        ) : (
          <OrderFormSubmissionSnapshotContent snapshot={snapshot} submittedAt={submittedAt} />
        )}

        {photos.length > 0 ? (
          <section className="mt-6">
            <h2 className="mb-2 text-fluid-sm font-semibold text-gray-900">첨부 사진</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
                  onClick={() => setPreview(p)}
                >
                  <img src={p.secureUrl} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={() => setPreview(null)}
        >
          <img
            src={preview.secureUrl}
            alt=""
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
