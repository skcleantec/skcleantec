import {
  cloneElement,
  isValidElement,
  useMemo,
  type CSSProperties,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { resolvePageNavFavoriteFromPath } from '../../utils/resolveNavFavoriteEntry';
import { NavFavoriteStar } from './NavFavoriteStar';

/** staff/admin/team 페이지 h1 — viewport fluid + 한 줄 말줄임 */
export const STAFF_PAGE_TITLE_CLASS =
  'min-w-0 max-w-full truncate whitespace-nowrap text-fluid-lg font-semibold leading-tight lg:text-fluid-xl';

const FIXED_TITLE_SIZE_CLASS =
  /\b(?:sm:|md:|lg:|xl:|2xl:)?text-(?:xs|sm|base|lg|xl|2xl|3xl|\[[^\]]+\])\b/g;

const BLOCK_TRUNCATE_CLASS = /\b(?:shrink-0|whitespace-pre-line|whitespace-normal|break-words)\b/g;

export function mergeStaffPageTitleClass(existing?: string): string {
  const cleaned = (existing ?? '')
    .replace(FIXED_TITLE_SIZE_CLASS, '')
    .replace(BLOCK_TRUNCATE_CLASS, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? `${STAFF_PAGE_TITLE_CLASS} ${cleaned}` : STAFF_PAGE_TITLE_CLASS;
}

function enhancePageTitleChild(child: ReactNode): ReactNode {
  if (!isValidElement(child) || child.type !== 'h1') return child;
  const el = child as ReactElement<{ className?: string; style?: CSSProperties; children?: ReactNode }>;
  const mergedClass = mergeStaffPageTitleClass(el.props.className);
  const nextStyle = el.props.style ? { ...el.props.style } : undefined;
  if (nextStyle?.fontSize != null) {
    delete nextStyle.fontSize;
  }
  const style = nextStyle && Object.keys(nextStyle).length > 0 ? nextStyle : undefined;
  const textLabel = typeof el.props.children === 'string' ? el.props.children : undefined;
  return cloneElement(el, {
    className: mergedClass,
    style,
    ...(textLabel ? { title: textLabel } : {}),
  } as Partial<typeof el.props>);
}

export function StaffPageTitle({ className, children, ...props }: ComponentProps<'h1'>) {
  return (
    <h1
      className={mergeStaffPageTitleClass(className)}
      title={typeof children === 'string' ? children : undefined}
      {...props}
    >
      {children}
    </h1>
  );
}

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
  className = 'flex min-w-0 flex-1 items-center gap-1',
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
      {enhancePageTitleChild(children)}
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
