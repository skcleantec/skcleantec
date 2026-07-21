/** 접수 상세 — 발주서 양식(카테고리) 배지 + 동적 추가 항목 답변 표시 (관리/팀장/타업체 공통) */

import { formatOrderFormListSnapshotValue } from '@shared/orderFormListSnapshot';

export interface OrderFormTemplateLite {
  id: string;
  title: string;
  icon: string | null;
  isDefault?: boolean;
  fields?: Array<{ fieldKey: string; label: string }>;
}

function renderAnswerValue(v: unknown, fieldKey?: string): string {
  return formatOrderFormListSnapshotValue(v, fieldKey);
}

/** 어떤 발주서 양식으로 들어온 접수인지 알려주는 작은 배지 */
export function OrderFormTemplateBadge({
  template,
  className = '',
}: {
  template: OrderFormTemplateLite | null | undefined;
  className?: string;
}) {
  if (!template) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-fluid-2xs font-medium text-gray-700 ${className}`}
      title={`발주서 양식: ${template.title}`}
    >
      {template.icon ? <span aria-hidden>{template.icon}</span> : null}
      <span className="max-w-[10rem] truncate">{template.title}</span>
    </span>
  );
}

/** 동적 추가 항목(라벨: 값) 목록 — 답변이 있을 때만 렌더 */
export function OrderFormCustomAnswers({
  template,
  answers,
  className = '',
  compact = false,
}: {
  template: OrderFormTemplateLite | null | undefined;
  answers: Record<string, unknown> | null | undefined;
  className?: string;
  compact?: boolean;
}) {
  if (!answers || typeof answers !== 'object') return null;
  const labelByKey = new Map((template?.fields ?? []).map((f) => [f.fieldKey, f.label]));
  const entries = Object.entries(answers)
    .filter(([, v]) => renderAnswerValue(v).trim() !== '')
    .map(([k, v]) => ({
      key: k,
      label: labelByKey.get(k) ?? k,
      value: renderAnswerValue(v, k),
    }));
  if (entries.length === 0) return null;
  if (compact) {
    return (
      <section className={`min-w-0 border-b border-gray-100 py-1 ${className}`}>
        <h3 className="mb-px text-[11px] font-semibold text-gray-500">발주서 추가 정보</h3>
        <dl className="space-y-px">
          {entries.map((e) => (
            <div key={e.key} className="flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0 leading-tight">
              <dt className="shrink-0 text-[11px] font-medium text-gray-500">{e.label}</dt>
              <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-fluid-2xs text-gray-900">{e.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }
  return (
    <div className={`rounded-lg border border-gray-200 bg-white ${className}`}>
      <div className="border-b border-gray-100 px-3 py-2 text-fluid-xs font-medium text-gray-600">
        발주서 추가 정보
      </div>
      <dl className="divide-y divide-gray-100">
        {entries.map((e) => (
          <div key={e.key} className="grid grid-cols-1 gap-0.5 px-3 py-2 sm:grid-cols-[8rem_1fr] sm:gap-3">
            <dt className="text-fluid-xs font-medium text-gray-500">{e.label}</dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words text-fluid-sm text-gray-900">{e.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
