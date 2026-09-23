import type { GuideSection } from '../../constants/orderInfoDefaultSections';
import { OrderFormGuideSectionCheck } from './OrderFormGuideSectionCheck';

export function OrderFormGuideSections(props: {
  sections: GuideSection[];
  agreeMode?: boolean;
  checkedByIndex?: boolean[];
  onToggle?: (index: number, next: boolean) => void;
}) {
  const { sections, agreeMode = false, checkedByIndex, onToggle } = props;
  return (
    <div className="space-y-6">
      {sections.map((section, i) => (
        <section
          key={`${section.title}:${i}`}
          className={agreeMode ? 'rounded-xl border border-gray-200 bg-white px-3.5 py-3.5' : undefined}
        >
          <h2 className="mb-3 border-b border-gray-200 pb-2 text-sm font-semibold whitespace-pre-line text-gray-900">
            {section.title}
          </h2>
          <ul className="space-y-3">
            {section.items.map((item, j) => (
              <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-gray-600">
                <span className="shrink-0 text-gray-400">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {agreeMode ? (
            <OrderFormGuideSectionCheck
              id={`order-guide-section-${i}`}
              title={section.title}
              checked={Boolean(checkedByIndex?.[i])}
              onChange={(next) => onToggle?.(i, next)}
            />
          ) : null}
        </section>
      ))}
    </div>
  );
}
