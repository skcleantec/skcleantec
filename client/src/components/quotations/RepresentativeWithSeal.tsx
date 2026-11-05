import { useEffect, useState } from 'react';
import { useTrimmedSealUrl } from '../../hooks/useTrimmedSealUrl';

/**
 * 대표명(왼쪽) + 「(인)」·직인(오른쪽 끝 전용 칸).
 * 직인은 「(인)」 중앙에 absolute 겹침 — 이름은 밀지 않고, 도장 칸과 글자가 겹치지 않음.
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
      className={`relative z-[1] flex w-full min-w-0 items-center justify-between gap-3 overflow-visible leading-snug ${className}`}
    >
      <span className="min-w-0 truncate whitespace-nowrap">대표 {repName}</span>
      <span
        className="relative inline-flex shrink-0 items-center justify-center overflow-visible"
        style={{ width: sealWidth, height: sealWidth }}
        aria-hidden={sealFailed ? undefined : true}
      >
        <span className="relative z-0 select-none whitespace-nowrap">(인)</span>
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
