import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { KakaoPostcodeEmbed, type Address as KakaoPostcodeAddress } from 'react-daum-postcode';

interface AddressSearchProps {
  value: string;
  onChange: (address: string, detail?: string) => void;
  placeholder?: string;
  className?: string;
  /** 공개·체결 폼 등 모바일 우선 — 전체 화면에 가깝게 우편번호 검색 */
  mobilePreferred?: boolean;
  /** 잠금(읽기전용) — 검색 버튼·레이어 비활성, 값만 표시 */
  disabled?: boolean;
}

/**
 * 카카오 우편번호 완료 → 도로명 한 줄 우선.
 * 지번/기본 `address`는 광역시명이 빠진 표기(대전 서구 …)인 경우가 많아, 지역 필터·행정명 일치를 위해
 * `roadAddress`(및 자동 매핑 도로명)를 먼저 쓴다.
 */
function addressLineFromPostcodeData(data: KakaoPostcodeAddress) {
  const road = (data.roadAddress ?? '').trim();
  const autoRoad = (data.autoRoadAddress ?? '').trim();
  const main = (data.address ?? '').trim();
  const jibun = (data.jibunAddress ?? '').trim();
  const autoJibun = (data.autoJibunAddress ?? '').trim();
  const fullAddress = road || autoRoad || main || jibun || autoJibun;
  const buildingName = data.buildingName ? ` ${data.buildingName}` : '';
  return fullAddress + buildingName;
}

/**
 * 팝업(window.open)은 모바일에서 히스토리/복귀 시 SPA 라우트가 꼬일 수 있어,
 * 같은 문서 내 임베드 레이어로만 연다.
 */
export function AddressSearch({ value, onChange, placeholder, className = '', mobilePreferred = false, disabled = false }: AddressSearchProps) {
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
      <div className={`flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch ${className}`}>
        <textarea
          readOnly
          rows={2}
          value={value}
          placeholder={placeholder ?? '주소 검색'}
          aria-readonly
          className={`flex-1 min-w-0 resize-none overflow-y-auto break-words rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm leading-snug ${mobilePreferred ? 'text-fluid-sm py-2.5' : ''}`}
        />
        <button
          type="button"
          onClick={() => setLayerOpen(true)}
          disabled={disabled}
          className={`w-full touch-manipulation whitespace-nowrap rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto sm:shrink-0 ${mobilePreferred ? 'min-h-[44px] text-fluid-xs' : ''}`}
        >
          주소 검색
        </button>
      </div>

      {!disabled && layerOpen &&
        createPortal(
          <div
            className={`fixed inset-0 z-[600] flex flex-col bg-black/50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${mobilePreferred ? 'bg-black/60' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="주소 검색"
          >
            <div
              className={
                mobilePreferred
                  ? 'flex min-h-0 flex-1 flex-col'
                  : 'flex min-h-0 flex-1 flex-col p-3 sm:p-4 sm:items-center sm:justify-center'
              }
              onClick={() => setLayerOpen(false)}
            >
              <div
                className={
                  mobilePreferred
                    ? 'flex min-h-0 flex-1 flex-col overflow-hidden bg-white'
                    : 'flex max-h-[min(100dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl sm:max-h-[85vh]'
                }
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-3 py-2 sm:px-4">
                  <span className={`font-medium text-gray-800 ${mobilePreferred ? 'text-fluid-sm' : 'text-sm'}`}>주소 검색</span>
                  <button
                    type="button"
                    onClick={() => setLayerOpen(false)}
                    className="min-h-[44px] min-w-[44px] touch-manipulation rounded px-3 text-fluid-sm text-gray-600 hover:bg-gray-100"
                  >
                    닫기
                  </button>
                </div>
                <div className={`min-h-0 flex-1 overflow-hidden ${mobilePreferred ? '' : 'overflow-auto p-2 sm:p-3'}`}>
                  <div
                    className={
                      mobilePreferred
                        ? 'h-full w-full min-h-[320px]'
                        : 'h-[min(420px,55vh)] w-full min-h-[320px] sm:h-[min(480px,60vh)]'
                    }
                  >
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
