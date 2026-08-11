import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { OrderFormSubmissionConsents } from '@shared/orderFormConsents';
import { getPublicOrderGuide } from '../../api/orderform';
import { ORDER_GUIDE_DEFAULT_SECTIONS, type GuideSection } from '../../constants/orderInfoDefaultSections';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import { OrderFormGuideSections } from './OrderFormGuideSections';
import { OrderFormPartnerConsentBlock } from './OrderFormPartnerConsentBlock';
import {
  OrderFormConsentStamp,
  OrderFormConsentsSummary,
  OrderFormSnapshotAckBlock,
} from './OrderFormConsentUi';

export function OrderFormGuideAgreeModal(props: {
  open: boolean;
  onClose: () => void;
  /** agree: 제출 전 동의(스크롤·동의 버튼) · view: 제출 확인서 등 재열람 */
  mode?: 'agree' | 'view';
  onAgree?: () => void;
  /** view 모드 — 제출 스냅샷 동의 이력 */
  consents?: OrderFormSubmissionConsents | null;
}) {
  const { open, onClose, mode = 'agree', onAgree, consents = null } = props;
  const isViewMode = mode === 'view';
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sections, setSections] = useState<GuideSection[]>(ORDER_GUIDE_DEFAULT_SECTIONS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);

  const checkScrollEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight <= 32;
    setScrolledToEnd(atEnd);
  }, []);

  useEffect(() => {
    if (!open) {
      setScrolledToEnd(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    void getPublicOrderGuide()
      .then((data) => {
        if (data.sections?.length) setSections(data.sections);
        else setSections(ORDER_GUIDE_DEFAULT_SECTIONS);
        setLoadError(false);
      })
      .catch(() => {
        setLoadError(true);
        setSections(ORDER_GUIDE_DEFAULT_SECTIONS);
      })
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open || loading) return;
    setScrolledToEnd(false);
    const id = window.requestAnimationFrame(() => checkScrollEnd());
    return () => window.cancelAnimationFrame(id);
  }, [open, loading, sections, checkScrollEnd]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1003] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[min(92vh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-guide-agree-title"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="shrink-0 border-b border-gray-100 bg-gray-800 px-4 pb-4 pt-5 pr-14 text-white">
          <h2 id="order-guide-agree-title" className="text-base font-semibold tracking-tight">
            서비스 안내사항
          </h2>
          <p className="mt-1 text-fluid-xs text-gray-300">
            {isViewMode
              ? '제출 후에도 아래 안내사항을 다시 확인하실 수 있습니다.'
              : '아래 내용을 끝까지 확인한 뒤 동의해 주세요.'}
          </p>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-5 sm:px-6"
          onScroll={checkScrollEnd}
        >
          {loadError ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-800">
              최신 안내를 불러오지 못해 기본 안내를 표시합니다.
            </p>
          ) : null}
          {loading ? (
            <p className="text-center text-fluid-sm text-gray-500">불러오는 중…</p>
          ) : (
            <>
              {isViewMode && consents ? (
                <OrderFormConsentsSummary consents={consents} className="mb-6" />
              ) : null}
              <OrderFormPartnerConsentBlock />
              <div className="mt-8">
                {isViewMode ? (
                  <div className="space-y-8">
                    {sections.map((section, i) => (
                      <section key={i}>
                        <h2 className="mb-3 border-b border-gray-200 pb-2 text-sm font-semibold whitespace-pre-line text-gray-900">
                          {section.title}
                        </h2>
                        <ul className="space-y-3">
                          {section.items.map((item, j) => (
                            <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-gray-600">
                              <span className="shrink-0 text-gray-400">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                        {section.title.includes('취소') && section.title.includes('변경') ? (
                          <div className="mt-4 space-y-2">
                            {consents?.serviceDate?.ackBody ? (
                              <OrderFormSnapshotAckBlock
                                ackBody={consents.serviceDate.ackBody}
                                consentKind="serviceDate"
                                agreedAt={consents.serviceDate.agreedAt}
                              />
                            ) : consents?.serviceDate?.agreedAt ? (
                              <OrderFormConsentStamp
                                kind="serviceDate"
                                agreedAt={consents.serviceDate.agreedAt}
                              />
                            ) : null}
                          </div>
                        ) : null}
                      </section>
                    ))}
                  </div>
                ) : (
                  <OrderFormGuideSections sections={sections} />
                )}
              </div>
              <div className="mt-8 rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3.5 text-fluid-sm leading-relaxed shadow-sm">
                <p className="font-bold text-amber-950">
                  <span className="text-red-700">전화번호·주소·청소날짜·시작시간</span>
                  이 정확히 기재되셨나요?
                </p>
                <p className="mt-2.5 font-medium text-amber-950">
                  상담사와의 통화 내용에{' '}
                  <span className="font-bold text-red-700">특이사항</span>이 있는 경우 꼭 적어주세요.
                </p>
                <p className="mt-2 font-bold text-red-800">기재 누락 시 본사에서 책임지지 않습니다.</p>
                {isViewMode && consents ? (
                  <div className="mt-4 space-y-2 border-t border-amber-200/80 pt-3">
                    {consents.timeSlot?.ackBody || consents.timeSlot?.agreedAt ? (
                      <OrderFormSnapshotAckBlock
                        ackBody={consents.timeSlot?.ackBody}
                        consentKind="timeSlot"
                        agreedAt={consents.timeSlot?.agreedAt}
                      />
                    ) : null}
                    {consents.guideTerms?.agreedAt ? (
                      <OrderFormConsentStamp kind="guideTerms" agreedAt={consents.guideTerms.agreedAt} />
                    ) : null}
                  </div>
                ) : null}
              </div>
              <p className="mt-6 text-center text-fluid-xs text-gray-500">
                문의사항은 예약 번호로 연락 부탁드립니다.
              </p>
            </>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-gray-100 bg-gray-50/90 px-4 py-3 sm:px-6">
          {isViewMode ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-fluid-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50"
            >
              닫기
            </button>
          ) : (
            <>
              {!scrolledToEnd && !loading ? (
                <p className="text-center text-fluid-2xs text-gray-500">맨 아래까지 스크롤하면 동의할 수 있습니다.</p>
              ) : null}
              <button
                type="button"
                disabled={loading || !scrolledToEnd}
                onClick={() => {
                  onAgree?.();
                  onClose();
                }}
                className="w-full rounded-lg bg-gray-900 px-4 py-3 text-fluid-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                모든사항을 확인했고 이에 모두 동의합니다.
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
