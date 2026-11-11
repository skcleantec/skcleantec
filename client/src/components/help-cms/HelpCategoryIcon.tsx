import { HELP_CATEGORY_ART } from '@shared/helpHomeConfig';

type Props = {
  slug: string | null | undefined;
  /** 그림 한 변 길이(px). 화면 폭마다 다르면 빼고 className(h-·w-)으로 준다 */
  size?: number;
  className?: string;
};

/** 도움말 분류 그림 — 없는 분류면 아무것도 그리지 않는다 */
export function HelpCategoryIcon({ slug, size, className = '' }: Props) {
  const art = slug ? HELP_CATEGORY_ART[slug] : undefined;
  if (!art) return null;
  return (
    <img
      src={art.icon}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={size ? { width: size, height: size } : undefined}
      className={`block shrink-0 ${className}`.trim()}
    />
  );
}
