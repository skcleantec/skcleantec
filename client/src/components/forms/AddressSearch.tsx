import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { KakaoPostcodeEmbed } from 'react-daum-postcode';

interface AddressSearchProps {
  value: string;
  onChange: (address: string, detail?: string) => void;
  placeholder?: string;
  className?: string;
}

/** 카카오(구 다음) 주소 API 완료 콜백 데이터 (필요 필드만) */
function addressLineFromPostcodeData(data: {
  address?: string;
  roadAddress?: string;
  jibunAddress?: string;
  buildingName?: string;
}) {
  const fullAddress = data.address || data.roadAddress || data.jibunAddress || '';
  const buildingName = data.buildingName ? ` ${data.buildingName}` : '';
  return fullAddress + buildingName;
}

/**
 * 팝업(window.open)은 모바일에서 히스토리/복귀 시 SPA 라우트가 꼬일 수 있어,
 * 같은 문서 내 임베드 레이어로만 연다.
 */
export function AddressSearch({ value, onChange, placeholder, className = '' }: AddressSearchProps) {
  const [layerOpen, setLayerOpen] = useState(false);

  useEffect(() => {
    if (!layerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [layerOpen]);

  useEffect(() => {
    if (!layerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLayerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layerOpen]);

  const handleComplete: React.ComponentProps<typeof KakaoPostcodeEmbed>['onComplete'] = (data) => {
    if (!data) return;
    onChange(addressLineFromPostcodeData(data));
    setLayerOpen(false);
  };

  return (
    <>
      <div className={`flex gap-2 ${className}`}>
        <input
          type="text"
          value={value}
          readOnly
          placeholder={placeholder ?? '주소 검색'}
          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50 min-w-0"
        />
        <button
          type="button"
          onClick={() => setLayerOpen(true)}
          className="shrink-0 px-4 py-2 bg-gray-700 text-white rounded text-sm font-medium hover:bg-gray-800 whitespace-nowrap touch-manipulation"
        >
          주소 검색
        </button>
      </div>

      {layerOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[600] flex flex-col bg-black/50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
            role="dialog"
            aria-modal="true"
            aria-label="주소 검색"
          >
            <div
              className="flex min-h-0 flex-1 flex-col p-3 sm:p-4 sm:items-center sm:justify-center"
              onClick={() => setLayerOpen(false)}
            >
              <div
                className="flex max-h-[min(100dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl sm:max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">주소 검색</span>
                  <button
                    type="button"
                    onClick={() => setLayerOpen(false)}
                    className="min-h-[44px] min-w-[44px] touch-manipulation rounded px-2 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    닫기
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
                  <div className="h-[min(420px,55vh)] w-full min-h-[320px] sm:h-[min(480px,60vh)]">
                    <KakaoPostcodeEmbed
                      onComplete={handleComplete}
                      className="h-full w-full"
                      style={{ width: '100%', height: '100%', minHeight: 0 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
