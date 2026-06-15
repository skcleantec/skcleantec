import { HelpTooltip } from '../ui/HelpTooltip';

export function TenantSmtpFieldLabel({
  title,
  technicalTerm,
  hint,
  helpText,
}: {
  title: string;
  technicalTerm?: string;
  hint?: string;
  helpText?: string;
}) {
  return (
    <span className="flex flex-wrap items-start gap-1.5">
      <span className="block min-w-0 flex-1">
        <span className="text-sm font-medium text-gray-800">{title}</span>
        {technicalTerm ? (
          <span className="ml-1 text-[11px] font-normal text-gray-400">({technicalTerm})</span>
        ) : null}
        {hint ? <span className="mt-0.5 block text-xs font-normal text-gray-500">{hint}</span> : null}
      </span>
      {helpText ? <HelpTooltip text={helpText} className="mt-0.5 shrink-0" /> : null}
    </span>
  );
}
