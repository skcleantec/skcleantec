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

/** staff/admin 페이지 h1 — 모바일 컴팩트 fluid + 한 줄 말줄임 */
export const STAFF_PAGE_TITLE_CLASS =
  'min-w-0 max-w-full truncate whitespace-nowrap text-fluid-base font-semibold leading-tight sm:text-fluid-lg lg:text-fluid-xl';

/** 팀장(/team) 페이지 h1 — 모바일 더 컴팩트 fluid */
export const TEAM_PAGE_TITLE_CLASS =
  'min-w-0 max-w-full truncate whitespace-nowrap text-fluid-sm font-semibold leading-tight text-gray-800 sm:text-fluid-base lg:text-fluid-lg';

const FIXED_TITLE_SIZE_CLASS =
  /\b(?:sm:|md:|lg:|xl:|2xl:)?text-(?:xs|sm|base|lg|xl|2xl|3xl|\[[^\]]+\])\b/g;

const BLOCK_TRUNCATE_CLASS = /\b(?:shrink-0|whitespace-pre-line|whitespace-normal|break-words)\b/g;

function mergePageTitleClass(base: string, existing?: string): string {
  const cleaned = (existing ?? '')
    .replace(FIXED_TITLE_SIZE_CLASS, '')
    .replace(BLOCK_TRUNCATE_CLASS, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? `${base} ${cleaned}` : base;
}

export function mergeStaffPageTitleClass(existing?: string): string {
  return mergePageTitleClass(STAFF_PAGE_TITLE_CLASS, existing);
}

export function mergeTeamPageTitleClass(existing?: string): string {
  return mergePageTitleClass(TEAM_PAGE_TITLE_CLASS, existing);
}

function enhancePageTitleChild(child: ReactNode, teamLayout = false): ReactNode {
  if (!isValidElement(child) || child.type !== 'h1') return child;
  const el = child as ReactElement<{ className?: string; style?: CSSProperties; children?: ReactNode }>;
  const mergedClass = teamLayout
    ? mergeTeamPageTitleClass(el.props.className)
    : mergeStaffPageTitleClass(el.props.className);
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

export function TeamPageTitle({ className, children, ...props }: ComponentProps<'h1'>) {
  return (
    <h1
      className={mergeTeamPageTitleClass(className)}
      title={typeof children === 'string' ? children : undefined}
      {...props}
    >
      {children}
    </h1>
  );
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
  className = 'flex min-w-0 shrink-0 items-center gap-1',
  onDark = false,
  compact = false,
}: PageTitleWithFavoriteProps) {
  const location = useLocation();
  const isTeamRoute = location.pathname.startsWith('/team');
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
      {enhancePageTitleChild(children, isTeamRoute)}
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
