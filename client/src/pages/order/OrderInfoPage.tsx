import { useState, useEffect, useCallback } from 'react';
import { getPublicOrderGuide } from '../../api/orderform';
import type { GuideSection } from '../../constants/orderInfoDefaultSections';
import { ORDER_GUIDE_DEFAULT_SECTIONS } from '../../constants/orderInfoDefaultSections';
import { postOrderGuideAgreeTerms } from '../../utils/orderFormGuideBroadcast';

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
  const [sections, setSections] = useState<GuideSection[]>(ORDER_GUIDE_DEFAULT_SECTIONS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    getPublicOrderGuide()
      .then((data) => {
        if (data.sections?.length) setSections(data.sections);
        setLoadError(false);
      })
      .catch(() => {
        setLoadError(true);
        setSections(ORDER_GUIDE_DEFAULT_SECTIONS);
      })
      .finally(() => setLoading(false));
  }, []);

  const tryLeavePage = useCallback(() => {
    window.close();
    window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.history.back();
      }
    }, 200);
  }, []);

  const handleAgreeAndClose = useCallback(() => {
    postOrderGuideAgreeTerms();
    tryLeavePage();
  }, [tryLeavePage]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 py-8">
      <div className="max-w-lg mx-auto bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex min-w-0 items-start justify-between gap-3 bg-gray-800 px-6 py-5 text-white">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold tracking-tight">서비스 안내사항</h1>
            <p className="mt-1 text-sm text-gray-300">입주청소 이용 시 꼭 확인해 주세요</p>
          </div>
          <button
            type="button"
            onClick={tryLeavePage}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white hover:bg-white/20 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label="닫기"
          >
            <CircleXIcon className="h-5 w-5" />
          </button>
        </div>
        {loadError && (
          <p className="px-6 pt-4 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
            최신 안내를 불러오지 못해 기본 안내를 표시합니다. 잠시 후 다시 열어 주세요.
          </p>
        )}
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">불러오는 중…</div>
        ) : (
          <div className="p-6 space-y-8">
            {sections.map((section, i) => (
              <section key={i}>
                <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                  {section.title}
                </h2>
                <ul className="space-y-3">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex gap-2.5 text-sm text-gray-600 leading-relaxed">
                      <span className="text-gray-400 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        <div className="space-y-4 border-t border-gray-100 px-6 py-5">
          <p className="text-center text-sm text-gray-500">문의사항은 예약 번호로 연락 부탁드립니다.</p>
          <button
            type="button"
            onClick={handleAgreeAndClose}
            disabled={loading}
            className="w-full rounded-md bg-gray-800 py-3 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            확인하고 동의합니다.
          </button>
          <p className="text-center text-fluid-2xs text-gray-400">
            발주서를 작성 중이었다면 동의란이 체크됩니다. 창이 닫히지 않으면 탭을 직접 닫아 주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
