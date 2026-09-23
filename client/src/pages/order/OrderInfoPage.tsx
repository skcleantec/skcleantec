import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPublicOrderGuide } from '../../api/orderform';
import { resolvePublicBrandSlug } from '../../utils/publicTenantQuery';
import type { GuideSection } from '../../constants/orderInfoDefaultSections';
import { ORDER_GUIDE_DEFAULT_SECTIONS } from '../../constants/orderInfoDefaultSections';
import { postOrderGuideAgreeTerms } from '../../utils/orderFormGuideBroadcast';
import { OrderFormPartnerConsentBlock } from '../../components/orderform/OrderFormPartnerConsentBlock';
import { OrderFormGuideSections } from '../../components/orderform/OrderFormGuideSections';
import { OrderFormGuideSignatureBlock } from '../../components/orderform/OrderFormGuideSignatureBlock';
import { tryLeavePublicPage } from '../../utils/publicPageLeave';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';

function CircleXIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function OrderInfoPage() {
  const [searchParams] = useSearchParams();
  const brandSlug =
    searchParams.get('brand')?.trim().toLowerCase() || resolvePublicBrandSlug() || undefined;
  const templateId = searchParams.get('templateId')?.trim() || undefined;
  const [formTitle, setFormTitle] = useState('');
  const [sections, setSections] = useState<GuideSection[]>(ORDER_GUIDE_DEFAULT_SECTIONS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [sectionChecked, setSectionChecked] = useState<boolean[]>([]);
  const [partnerChecked, setPartnerChecked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, !loading);

  const checkScrollEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const leftover = el.scrollHeight - el.scrollTop - el.clientHeight;
    setScrolledToEnd(el.scrollHeight <= el.clientHeight + 48 || leftover <= 48);
  }, []);

  useEffect(() => {
    getPublicOrderGuide({ brandSlug, templateId })
      .then((data) => {
        if (data.sections?.length) setSections(data.sections);
        if (data.formTitle?.trim()) setFormTitle(data.formTitle.trim());
        setLoadError(false);
      })
      .catch(() => {
        setLoadError(true);
        setSections(ORDER_GUIDE_DEFAULT_SECTIONS);
      })
      .finally(() => setLoading(false));
  }, [brandSlug, templateId]);

  useEffect(() => {
    setSectionChecked(sections.map(() => false));
    setPartnerChecked(false);
  }, [sections]);

  useEffect(() => {
    if (loading) return;
    setScrolledToEnd(false);
    const id = window.requestAnimationFrame(() => checkScrollEnd());
    const t1 = window.setTimeout(checkScrollEnd, 120);
    const t2 = window.setTimeout(checkScrollEnd, 400);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [loading, sections, checkScrollEnd]);

  const tryLeavePage = useCallback(() => {
    tryLeavePublicPage();
  }, []);

  const handleSigned = useCallback(
    (payload: { signaturePng: string; typedName: string }) => {
      postOrderGuideAgreeTerms({
        agreedAt: new Date().toISOString(),
        signaturePng: payload.signaturePng,
        typedName: payload.typedName,
      });
      tryLeavePage();
    },
    [tryLeavePage],
  );

  const allSectionsChecked =
    sections.length > 0 &&
    sectionChecked.length === sections.length &&
    sectionChecked.every(Boolean);
  const canSign = !loading && scrolledToEnd && allSectionsChecked && partnerChecked;

  return (
    <div className="flex min-h-[100dvh] items-stretch justify-center bg-gray-50 p-0 sm:items-center sm:p-4 sm:py-8">
      <div className="flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[min(92vh,48rem)] sm:rounded-lg sm:border sm:border-gray-200 sm:shadow-sm">
        <div className="flex min-w-0 shrink-0 items-start justify-between gap-3 bg-gray-800 px-6 py-5 text-white">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold tracking-tight">서비스 안내사항</h1>
            <p className="mt-1 text-sm text-gray-300">
              {formTitle
                ? `${formTitle} 이용 시 각 항목을 체크한 뒤 맨 아래까지 내려 서명해 주세요`
                : '각 항목을 읽고 체크한 뒤, 맨 아래까지 내려 서명해 주세요'}
            </p>
          </div>
          <button
            type="button"
            onClick={tryLeavePage}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
            aria-label="닫기"
          >
            <CircleXIcon className="h-5 w-5" />
          </button>
        </div>
        {loadError && (
          <p className="shrink-0 border-b border-amber-100 bg-amber-50 px-6 pt-4 pb-3 text-xs text-amber-700">
            최신 안내를 불러오지 못해 기본 안내를 표시합니다. 잠시 후 다시 열어 주세요.
          </p>
        )}
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">불러오는 중…</div>
        ) : (
          <div
            ref={scrollRef}
            className="modal-form-scroll-surface min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-y-contain px-6 py-6"
            onScroll={checkScrollEnd}
            onFocusCapture={onFieldFocus}
          >
            <OrderFormPartnerConsentBlock
              agreeMode
              checked={partnerChecked}
              onToggle={setPartnerChecked}
            />
            <OrderFormGuideSections
              sections={sections}
              agreeMode
              checkedByIndex={sectionChecked}
              onToggle={(index, next) => {
                setSectionChecked((prev) => {
                  const copy = prev.length === sections.length ? [...prev] : sections.map(() => false);
                  copy[index] = next;
                  return copy;
                });
              }}
            />
            <p className="text-center text-sm text-gray-500">문의사항은 예약 번호로 연락 부탁드립니다.</p>
            <OrderFormGuideSignatureBlock disabled={!canSign} onSigned={handleSigned} />
          </div>
        )}
        <div className="shrink-0 border-t border-gray-100 px-6 py-3">
          <p className="text-center text-fluid-2xs leading-snug text-gray-500">
            {canSign
              ? '성함을 직접 적은 뒤 아래에 서명하고 「서명으로 동의」를 눌러 주세요.'
              : !scrolledToEnd
                ? '맨 아래까지 스크롤한 뒤, 모든 필수 항목에 체크해 주세요.'
                : '모든 필수 항목에 체크하면 성함과 서명을 남길 수 있습니다.'}
          </p>
          <p className="mt-1.5 text-center text-fluid-2xs text-gray-400">
            발주서를 작성 중이었다면 서명 후 동의란이 채워집니다. 창이 닫히지 않으면 탭을 직접 닫아 주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
