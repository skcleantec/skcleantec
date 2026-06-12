const LOGO_SRC = '/brand/clean-secretary-logo.png';

type TenantBrandLogoProps = {
  /** 표시 높이(px). 가로는 비율 유지 */
  height?: number;
  className?: string;
};

/**
 * 테넌트 업무 화면 GNB — 청소비서 브랜드 로고 (업체명 대신 고정 표시).
 * 제공 PNG는 흰색 로고 + 검정 배경 → 다크 헤더에서 `mix-blend-lighten`으로 배경을 녹임.
 */
export function TenantBrandLogo({ height = 30, className = '' }: TenantBrandLogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt="청소비서 CleanSecretary"
      width={Math.round(height * 3.2)}
      className={`block w-auto max-w-[min(168px,42vw)] shrink-0 object-contain object-left mix-blend-lighten ${className}`.trim()}
      style={{ height }}
      decoding="async"
    />
  );
}
