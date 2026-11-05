import { useEffect, useState } from 'react';
import { useTrimmedSealUrl } from '../../hooks/useTrimmedSealUrl';

/** 대표명 + 「(인)」, 직인은 「(인)」 중앙에 absolute 겹침 — 줄·이름을 밀지 않음 */
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
  return (
    <p className={`relative z-[1] leading-snug overflow-visible ${className}`}>
      <span className="whitespace-nowrap">대표 {repName}</span>
      {displayUrl ? (
        <span className="relative ml-2.5 inline-block overflow-visible whitespace-nowrap align-baseline">
          (인)
          {!sealFailed ? (
            <img
              src={displayUrl}
              alt=""
              onError={() => setSealFailed(true)}
              width={sealWidth}
              className="pointer-events-none absolute max-w-none object-contain"
              style={{
                width: sealWidth,
                height: sealWidth,
                maxWidth: 'none',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ) : null}
        </span>
      ) : null}
    </p>
  );
}
