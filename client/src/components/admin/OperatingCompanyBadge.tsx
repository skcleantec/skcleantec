/** 접수·스케줄·사용자 목록 등 — 영업 브랜드(Operating Company) 표시 */
export type OperatingCompanyBadgeData = {
  id?: string;
  name: string;
  slug?: string;
  isActive?: boolean;
};

export function OperatingCompanyBadge({
  company,
  className = '',
}: {
  company: OperatingCompanyBadgeData | null | undefined;
  className?: string;
}) {
  if (!company?.name?.trim()) return null;
  const inactive = company.isActive === false;
  return (
    <span
      className={`inline-flex max-w-full items-center rounded px-1.5 py-0.5 text-fluid-2xs font-medium truncate ${
        inactive ? 'bg-gray-100 text-gray-600 line-through' : 'bg-indigo-50 text-indigo-900'
      } ${className}`}
      title={company.slug ? `${company.name} (${company.slug})` : company.name}
    >
      {company.name}
    </span>
  );
}
