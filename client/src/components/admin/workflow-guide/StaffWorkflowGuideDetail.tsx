import type { WorkflowGuideStep } from './workflowGuideSteps';

type Props = {
  step: WorkflowGuideStep;
};

export function StaffWorkflowGuideDetail({ step }: Props) {
  return (
    <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2">
      <p className="text-fluid-2xs font-medium leading-relaxed text-slate-800">{step.tip}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {step.sections.map((section) => (
          <div key={section.title} className="min-w-0">
            <p className="text-fluid-2xs font-semibold text-slate-700">{section.title}</p>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-3.5 text-fluid-2xs leading-snug text-slate-500">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
