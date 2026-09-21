import type { OrderFormTemplate } from '../../../api/orderFormTemplates';

/** 기본·사용 중인 양식은 삭제 불가. 안 쓰는 내가 만든 양식만. */
export function canDeleteOrderFormTemplate(
  template: Pick<OrderFormTemplate, 'isDefault' | 'status'>,
): boolean {
  return !template.isDefault && template.status !== 'PUBLISHED';
}

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
