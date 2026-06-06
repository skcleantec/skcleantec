import { operatingCompanyBadgeColorClasses } from '../../utils/operatingCompanyBadgeColors';

/** 접수·스케줄·사용자 목록 등 — 영업 브랜드(Operating Company) 표시 */
export type OperatingCompanyBadgeData = {
  id?: string;
  name: string;
  slug?: string;
  isActive?: boolean;
  badgeColorKey?: string | null;
};

export function OperatingCompanyBadge({
  company,
  className = '',
  suffix,
}: {
  company: OperatingCompanyBadgeData | null | undefined;
  className?: string;
  /** 예: primary 표시 ` ·기본` */
  suffix?: string | null;
}) {
  if (!company?.name?.trim()) return null;
  const inactive = company.isActive === false;
  const colorCls = operatingCompanyBadgeColorClasses({
    id: company.id,
    slug: company.slug,
    name: company.name,
    badgeColorKey: company.badgeColorKey,
    inactive,
  });
  return (
    <span
      className={`inline-flex max-w-full items-center rounded px-1.5 py-0.5 text-fluid-2xs font-medium truncate ${colorCls} ${className}`}
      title={company.slug ? `${company.name} (${company.slug})` : company.name}
    >
      {company.name}
      {suffix ? <span className="opacity-80">{suffix}</span> : null}
    </span>
  );
}
