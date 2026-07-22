import { CLEAN_SECRETARY_LOGO_ALT, CLEAN_SECRETARY_LOGO_SRC } from '@shared/brandLogo';

type TenantBrandLogoProps = {
  /** 표시 높이(px). 가로는 비율 유지 */
  height?: number;
  className?: string;
  /** on-dark: 다크 GNB(기본). on-light: 밝은 배경 — 검정 래퍼 */
  surface?: 'on-dark' | 'on-light';
};

/**
 * 청소비서 공식 로고 — GNB·로그인 등 단일 자산 (`/brand/clean-secretary-logo.png`).
 */
export function TenantBrandLogo({
  height = 30,
  className = '',
  surface = 'on-dark',
}: TenantBrandLogoProps) {
  const img = (
    <img
      src={CLEAN_SECRETARY_LOGO_SRC}
      alt={CLEAN_SECRETARY_LOGO_ALT}
      width={Math.round(height * 3.2)}
      className={[
        'block w-auto max-w-[min(168px,42vw)] shrink-0 object-contain object-left',
        surface === 'on-dark' ? 'mix-blend-lighten' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ height }}
      decoding="async"
    />
  );

  if (surface === 'on-light') {
    return (
      <span className="inline-flex rounded-lg bg-black px-3 py-1.5 shadow-sm ring-1 ring-black/10">
        {img}
      </span>
    );
  }

  return img;
}
