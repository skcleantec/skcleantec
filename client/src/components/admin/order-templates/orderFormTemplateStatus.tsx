import type { OrderFormTemplate } from '../../../api/orderFormTemplates';

export function OrderFormTemplateStatusBadge({ status }: { status: OrderFormTemplate['status'] }) {
  if (status === 'PUBLISHED') {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-fluid-2xs font-medium text-emerald-700">
        발행됨
      </span>
    );
  }
  if (status === 'ARCHIVED') {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-fluid-2xs font-medium text-slate-500">
        보관
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-fluid-2xs font-medium text-amber-700">
      초안
    </span>
  );
}
