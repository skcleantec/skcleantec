import { useEffect, useState } from 'react';
import { useTrimmedSealUrl } from '../../hooks/useTrimmedSealUrl';

/**
 * 대표명(왼쪽) + 「(인)」(오른쪽). 직인은 absolute로 「(인)」 중앙에만 찍혀
 * 줄 높이는 다른 공급자 줄과 같다(60px 칸 높이로 줄을 키우지 않음).
 */
export function RepresentativeWithSeal({
  repName,
  sealUrl,
  sealWidth,
  className = 'text-[13px] text-slate-800',
}: {
  repName: string;
  sealUrl: string | null;
  sealWidth: number;
  className?: string;
}) {
  const [sealFailed, setSealFailed] = useState(false);
  const trimmedSealUrl = useTrimmedSealUrl(sealUrl);
  useEffect(() => setSealFailed(false), [sealUrl, trimmedSealUrl]);
  const displayUrl = trimmedSealUrl || sealUrl;

  if (!displayUrl) {
    return (
      <p className={`leading-snug ${className}`}>
        <span className="whitespace-nowrap">대표 {repName}</span>
      </p>
    );
  }

  return (
    <p
      className={`relative z-[1] flex w-full min-w-0 items-baseline justify-between gap-3 overflow-visible leading-snug ${className}`}
    >
      <span className="min-w-0 truncate whitespace-nowrap">대표 {repName}</span>
      {/* 가로는 직인 폭만 예약, 세로는 글자 줄높이 — 도장은 absolute로 위·아래 빈 칸에 걸쳐짐 */}
      <span
        className="relative inline-block shrink-0 overflow-visible whitespace-nowrap text-center align-baseline"
        style={{ width: sealWidth }}
      >
        (인)
        {!sealFailed ? (
          <img
            src={displayUrl}
            alt=""
            onError={() => setSealFailed(true)}
            width={sealWidth}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
            style={{
              width: sealWidth,
              height: sealWidth,
              maxWidth: 'none',
            }}
          />
        ) : null}
      </span>
    </p>
  );
}
