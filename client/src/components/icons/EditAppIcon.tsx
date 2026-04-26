/**
 * 앱 공통 수정 아이콘.
 * - 기본: `public/icons/edit-universal.svg`
 * - Cloudinary 등 외부 이미지: `client/.env` 에 `VITE_APP_EDIT_ICON_URL` (빌드 시 주입)
 */
const DEFAULT_SRC = '/icons/edit-universal.svg';

function resolvedSrc(): string {
  const fromEnv = import.meta.env.VITE_APP_EDIT_ICON_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_SRC;
}

export type EditAppIconProps = {
  className?: string;
  /** img title (툴팁) */
  title?: string;
  alt?: string;
};

export function EditAppIcon({ className = 'h-4 w-4', title, alt = '수정' }: EditAppIconProps) {
  return (
    <img
      src={resolvedSrc()}
      alt={alt}
      title={title}
      className={`pointer-events-none select-none object-contain ${className}`}
      decoding="async"
    />
  );
}
