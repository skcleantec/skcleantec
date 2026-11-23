import type { OrderFollowupOtherBrand } from '../../api/orderFollowups';
import { ORDER_FOLLOWUP_STATUS_LABEL } from '../../constants/orderFollowupStatus';

/** 같은 고객이 다른 브랜드의 부재·보류에도 있을 때 붙는 작은 표시 */
export function OtherBrandsNote({
  otherBrands,
  className = '',
}: {
  otherBrands?: OrderFollowupOtherBrand[] | null;
  className?: string;
}) {
  if (!otherBrands?.length) return null;
  const names = [...new Set(otherBrands.map((brand) => brand.brandName))];
  return (
    <span
      title={otherBrands.map((brand) => `${brand.brandName} · ${ORDER_FOLLOWUP_STATUS_LABEL[brand.status]}`).join('\n')}
      className={`inline-flex max-w-full items-center truncate whitespace-nowrap rounded-md border border-sky-200 bg-sky-50 px-1 py-px text-[10.5px] font-semibold leading-tight text-sky-800 ${className}`}
    >
      {names.join('·')}에도 있음
    </span>
  );
}
