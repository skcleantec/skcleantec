import { useCallback, useEffect, useState } from 'react';
import {
  getOrderFormByToken,
  isOrderFormPublicSubmitted,
  listOrderFormPhotosByToken,
  resendOrderFormSubmissionEmailByToken,
  type OrderFormConfigPublic,
  type OrderFormPhotoItem,
  type OrderFormSubmissionEmailInfo,
} from '../../api/orderform';
import {
  ORDER_FORM_CONFIG_DEFAULTS,
  orderFormConfigLine,
} from '../../constants/orderFormConfigDefaults';
import { resolveOrderFormFooterNotices } from '../../utils/orderFormCustomerCopy';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import type { PublicOrderFormCompanyTrust } from '../../api/orderform';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';
import { OrderFormCompanyTrustFooter } from './OrderFormCompanyTrustFooter';
import { OrderFormPlatformFooter } from './OrderFormPlatformFooter';
import { OrderFormGuideAgreeModal } from './OrderFormGuideAgreeModal';
import { OrderFormModalFormattedText } from './OrderFormModalFormattedText';
import {
  isOrderFormSubmissionSnapshotV1,
  OrderFormSubmissionSnapshotContent,
} from './orderFormSubmissionSnapshot';
import type { OrderFormSubmissionConsents } from '@shared/orderFormConsents';

function submissionEmailStatusMessage(
  submissionEmail: OrderFormSubmissionEmailInfo | null | undefined,
  customerEmail: string | null | undefined,
): string {
  if (submissionEmail?.status === 'SENT') {
    return `입력하신 이메일(${submissionEmail.toEmail})로 접수 확인 메일을 발송했습니다.`;
  }
  if (submissionEmail?.status === 'FAILED') {
    return `접수는 완료되었으나 확인 메일 발송에 실패했습니다. 아래에서 다시 받기를 눌러 주세요.`;
  }
  if (submissionEmail?.status === 'SKIPPED_NO_PLATFORM_SMTP') {
    return '접수는 완료되었습니다. 메일 발송 설정을 확인 중일 수 있습니다. 아래에서 다시 받기를 시도해 주세요.';
  }
  if (submissionEmail?.status === 'SKIPPED_NO_SMTP') {
    return '접수는 완료되었습니다. 아래에서 확인 메일을 다시 받을 수 있습니다.';
  }
  if (customerEmail?.trim()) {
    return `${customerEmail.trim()}로 접수 확인 메일을 보내고 있습니다. 잠시 후 새로고침 없이 상태가 갱신됩니다.`;
  }
  return '이메일을 입력하시면 접수 확인 메일을 보내드립니다.';
}

export function OrderFormSubmissionReceiptView(props: {
  token: string;
  customerName: string;
  customerEmail?: string | null;
  submittedAt: string;
  inquiryNumber: string | null;
  snapshot: unknown | null;
  formConfig?: OrderFormConfigPublic;
  submissionEmail?: OrderFormSubmissionEmailInfo | null;
  publicCompanyTrust?: PublicOrderFormCompanyTrust | null;
  companyDisplayName?: string | null;
  headerRight?: React.ReactNode;
  onDismiss?: () => void;
  leaveHint?: string | null;
  onSubmissionEmailChange?: (info: OrderFormSubmissionEmailInfo | null) => void;
}) {
  const {
    token,
    customerName,
    customerEmail,
    submittedAt,
    inquiryNumber,
    snapshot,
    formConfig,
    submissionEmail: submissionEmailProp,
    publicCompanyTrust,
    companyDisplayName,
    headerRight,
    onDismiss,
    leaveHint,
    onSubmissionEmailChange,
  } = props;
  const { scrollRef, onFieldFocus } = useLoginScrollSurface();
  const [photos, setPhotos] = useState<OrderFormPhotoItem[]>([]);
  const [preview, setPreview] = useState<OrderFormPhotoItem | null>(null);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [submissionEmail, setSubmissionEmail] = useState(submissionEmailProp ?? null);
  const [additionalEmail, setAdditionalEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');

  const submissionConsents: OrderFormSubmissionConsents | null =
    snapshot != null && isOrderFormSubmissionSnapshotV1(snapshot)
      ? (snapshot.consents ?? null)
      : null;

  const guideLinkLabel = orderFormConfigLine(
    formConfig?.infoLinkText,
    ORDER_FORM_CONFIG_DEFAULTS.infoLinkText,
  );

  const successTitle = orderFormConfigLine(
    formConfig?.submitSuccessTitle,
    ORDER_FORM_CONFIG_DEFAULTS.submitSuccessTitle,
  );
  const successBody = orderFormConfigLine(
    formConfig?.submitSuccessBody,
    ORDER_FORM_CONFIG_DEFAULTS.submitSuccessBody,
  );
  const { line1: footerNotice1, line2: footerNotice2 } = resolveOrderFormFooterNotices(formConfig);

  const refreshSubmissionStatus = useCallback(async () => {
    try {
      const data = await getOrderFormByToken(token);
      if (!isOrderFormPublicSubmitted(data)) return;
      setSubmissionEmail(data.submissionEmail ?? null);
      onSubmissionEmailChange?.(data.submissionEmail ?? null);
    } catch {
      /* ignore */
    }
  }, [token, onSubmissionEmailChange]);

  const refreshPhotos = useCallback(async () => {
    try {
      const r = await listOrderFormPhotosByToken(token);
      setPhotos(r.items);
    } catch {
      /* 네트워크 일시 장애 */
    }
  }, [token]);

  useEffect(() => {
    setSubmissionEmail(submissionEmailProp ?? null);
  }, [submissionEmailProp]);

  useEffect(() => {
    void refreshPhotos();
  }, [refreshPhotos]);

  useEffect(() => {
    if (submissionEmail?.status === 'SENT') return;
    void refreshSubmissionStatus();
    const id = window.setInterval(() => {
      void refreshSubmissionStatus();
    }, 3000);
    const stop = window.setTimeout(() => window.clearInterval(id), 24_000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, [refreshSubmissionStatus, submissionEmail?.status, token]);

  const handleResend = async () => {
    setResending(true);
    setResendError('');
    setResendMessage('');
    try {
      const result = await resendOrderFormSubmissionEmailByToken(token, {
        additionalEmail: additionalEmail.trim() || null,
      });
      setSubmissionEmail(result.submissionEmail);
      onSubmissionEmailChange?.(result.submissionEmail);
      if (result.ok) {
        const extraOk = result.additionalResults?.filter((r) => r.ok).map((r) => r.email) ?? [];
        const extraFail = result.additionalResults?.filter((r) => !r.ok) ?? [];
        setResendMessage(
          extraOk.length > 0
            ? `접수 확인 메일을 보냈습니다. (추가: ${extraOk.join(', ')})`
            : '접수 확인 메일을 다시 보냈습니다.',
        );
        if (extraFail.length > 0) {
          setResendError(`추가 메일 일부 실패: ${extraFail.map((r) => r.email).join(', ')}`);
        }
      } else {
        setResendError(
          result.submissionEmail?.lastError ||
            '메일 발송에 실패했습니다. 스팸함을 확인하거나 잠시 후 다시 시도해 주세요.',
        );
      }
    } catch (e) {
      setResendError(e instanceof Error ? e.message : '메일 발송에 실패했습니다.');
    } finally {
      setResending(false);
    }
  };

  const storedEmail = customerEmail?.trim() || submissionEmail?.toEmail?.trim() || '';

  return (
    <div
      ref={scrollRef}
      onFocusCapture={onFieldFocus}
      className="login-surface min-h-screen overflow-y-auto overscroll-y-contain bg-gray-50 pb-12"
    >
      <div className="login-scroll-content mx-auto max-w-lg px-4 py-6">
        <div className="relative">
          {headerRight ? <div className="absolute top-0 right-0 z-10">{headerRight}</div> : null}

          {leaveHint ? (
            <div
              className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-xs leading-snug text-amber-900"
              role="status"
            >
              {leaveHint}
            </div>
          ) : null}

          <div className="mb-6 pr-16">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">제출 확인서</p>
            <h1 className="mt-1 text-lg font-semibold text-gray-900">
              <OrderFormModalFormattedText text={successTitle} className="break-words leading-snug" />
            </h1>
            <div className="mt-2 text-sm text-gray-600">
              <OrderFormModalFormattedText text={successBody} className="break-words leading-relaxed" />
            </div>
            {footerNotice1.trim() || footerNotice2.trim() ? (
              <div className="mt-4 space-y-1 text-center text-fluid-xs text-gray-500">
                {footerNotice1.trim() ? (
                  <p className="whitespace-pre-line">{footerNotice1}</p>
                ) : null}
                {footerNotice2.trim() ? (
                  <p className="whitespace-pre-line">{footerNotice2}</p>
                ) : null}
              </div>
            ) : null}
            <p className="mt-3 text-fluid-xs text-gray-500">
              이 링크를 저장해 두시면 제출 내용을 다시 확인할 수 있습니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setGuideModalOpen(true)}
            title={guideLinkLabel}
            className="mb-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-fluid-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            <span aria-hidden className="text-base leading-none">ℹ</span>
            안내사항 보기
          </button>

          <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-fluid-sm font-semibold text-gray-900">접수 확인 메일</h2>
            <p className="mt-1.5 text-fluid-xs leading-relaxed text-gray-600">
              {submissionEmailStatusMessage(submissionEmail, storedEmail || customerEmail)}
            </p>
            {submissionEmail?.lastError && submissionEmail.status !== 'SENT' ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-2xs text-amber-900">
                {submissionEmail.lastError}
              </p>
            ) : null}
            {storedEmail ? (
              <p className="mt-2 text-fluid-2xs text-gray-500">
                제출 시 입력한 이메일: <span className="font-medium text-gray-700">{storedEmail}</span>
              </p>
            ) : null}
            <label className="mt-3 block space-y-1">
              <span className="text-fluid-2xs font-medium text-gray-700">
                다른 메일함으로도 받기 (선택)
              </span>
              <input
                type="email"
                value={additionalEmail}
                onChange={(e) => setAdditionalEmail(e.target.value)}
                placeholder="example@email.com"
                className="login-field-input min-h-10 w-full rounded-lg border border-gray-300 px-3 text-fluid-xs text-gray-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                autoComplete="email"
              />
            </label>
            <button
              type="button"
              disabled={resending}
              onClick={() => void handleResend()}
              className="mt-3 min-h-11 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-fluid-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {resending ? '보내는 중…' : '접수 확인 메일 다시 받기'}
            </button>
            {resendMessage ? (
              <p className="mt-2 text-fluid-2xs text-emerald-700" role="status">
                {resendMessage}
              </p>
            ) : null}
            {resendError ? (
              <p className="mt-2 text-fluid-2xs text-red-700" role="alert">
                {resendError}
              </p>
            ) : null}
          </section>

          <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-fluid-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-gray-900">{customerName}</span>
              <span className="text-fluid-xs tabular-nums text-gray-500">
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

          <OrderFormCompanyTrustFooter
            trust={publicCompanyTrust}
            displayNameFallback={companyDisplayName}
          />

          {onDismiss ? (
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={onDismiss}
                className="min-h-11 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
              >
                확인했어요
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          ) : null}

          <div className="mt-6 border-t border-gray-200 pt-4">
            <OrderFormPlatformFooter />
          </div>
        </div>
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

      <OrderFormGuideAgreeModal
        open={guideModalOpen}
        mode="view"
        consents={submissionConsents}
        onClose={() => setGuideModalOpen(false)}
      />
    </div>
  );
}
