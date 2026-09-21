import { OrderFormCustomAnswers } from '../orderform/OrderFormTemplateInfo';
import type { TeamInquiryIntakeItem } from '../../utils/teamInquiryIntakeDisplay';
import {
  teamInquiryCustomAnswers,
  teamInquiryCustomRows,
  teamInquiryListChips,
} from '../../utils/teamInquiryIntakeDisplay';

export function TeamInquiryIntakeAnswers({
  item,
  compact = false,
}: {
  item: TeamInquiryIntakeItem & {
    orderForm?: { template?: { id: string; title: string; icon: string | null; fields?: Array<{ fieldKey: string; label: string }> } | null } | null;
  };
  compact?: boolean;
}) {
  const profile = item.intakeFormProfile;
  const answers = teamInquiryCustomAnswers(item);
  const rows = teamInquiryCustomRows(item);
  if (rows.length === 0 && Object.keys(answers).length === 0) return null;
  const template = profile
    ? {
        id: profile.templateId ?? item.orderForm?.template?.id ?? 'intake',
        title: profile.title,
        icon: profile.icon,
        fields: profile.customFields.map((f) => ({ fieldKey: f.fieldKey, label: f.label })),
      }
    : item.orderForm?.template;
  return <OrderFormCustomAnswers template={template} answers={answers} compact={compact} />;
}

export function TeamInquiryIntakeListChips({
  item,
  className = '',
}: {
  item: TeamInquiryIntakeItem;
  className?: string;
}) {
  const chips = teamInquiryListChips(item);
  if (chips.length === 0) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex shrink-0 items-center rounded-full bg-sky-50 px-1.5 py-0.5 text-fluid-2xs font-semibold text-sky-900 ring-1 ring-sky-200/80"
          title={`${chip.label} ${chip.value}`}
        >
          {chip.label} {chip.value}
        </span>
      ))}
    </span>
  );
}
