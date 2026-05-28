import type { GuideSection } from '../../constants/orderInfoDefaultSections';

export function OrderFormGuideSections(props: { sections: GuideSection[] }) {
  const { sections } = props;
  return (
    <div className="space-y-8">
      {sections.map((section, i) => (
        <section key={i}>
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
        </section>
      ))}
    </div>
  );
}
