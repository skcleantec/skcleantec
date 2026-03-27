import { useState, useEffect } from 'react';
import { getPublicOrderGuide } from '../../api/orderform';
import type { GuideSection } from '../../constants/orderInfoDefaultSections';
import { ORDER_GUIDE_DEFAULT_SECTIONS } from '../../constants/orderInfoDefaultSections';

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

  return (
    <div className="min-h-screen bg-gray-50 p-4 py-8">
      <div className="max-w-lg mx-auto bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gray-800 text-white px-6 py-5">
          <h1 className="text-lg font-semibold tracking-tight">서비스 안내사항</h1>
          <p className="text-gray-300 text-sm mt-1">입주청소 이용 시 꼭 확인해 주세요</p>
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
        <div className="px-6 pb-6 text-center">
          <p className="text-sm text-gray-500">문의사항은 예약 번호로 연락 부탁드립니다.</p>
        </div>
      </div>
    </div>
  );
}
