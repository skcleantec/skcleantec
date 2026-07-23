import { useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { resolvePageNavFavoriteFromPath } from '../../utils/resolveNavFavoriteEntry';
import { NavFavoriteStar } from './NavFavoriteStar';

export type PageTitleWithFavoriteProps = {
  children: ReactNode;
  /** 즐겨찾기 키 — 생략 시 pathname으로 자동 해석 */
  navKey?: string;
  /** 저장·표시 라벨 — 생략 시 경로 매핑 또는 페이지 제목 */
  label?: string;
  /** 기본값: 현재 location.pathname */
  path?: string;
  className?: string;
  onDark?: boolean;
  compact?: boolean;
};

/** 페이지 h1·제목 줄 옆 ★ — GNB 메뉴명이 아닌 본문 헤더에 붙인다 */
export function PageTitleWithFavorite({
  children,
  navKey,
  label,
  path,
  className = 'flex min-w-0 items-center gap-1',
  onDark = false,
  compact = false,
}: PageTitleWithFavoriteProps) {
  const location = useLocation();
  const favorite = useMemo(() => {
    if (navKey && label) return { navKey, label };
    const pathname = path ?? location.pathname;
    const resolved = resolvePageNavFavoriteFromPath(pathname);
    if (!resolved) return navKey && label ? { navKey, label } : null;
    if (navKey) return { navKey, label: label ?? resolved.label };
    if (label) return { navKey: resolved.navKey, label };
    return resolved;
  }, [navKey, label, path, location.pathname]);

  return (
    <div className={className}>
      {children}
      {favorite ? (
        <NavFavoriteStar
          navKey={favorite.navKey}
          label={favorite.label}
          onDark={onDark}
          compact={compact}
        />
      ) : null}
    </div>
  );
}
