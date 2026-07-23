import {
  formatInquiryIntakeChannelLabel,
  formatInquiryLeadPlatformLabel,
} from '@shared/inquiryIntakeChannel';

export function InquiryIntakeMetaLabels({
  source,
  intakeChannel,
  orderFormSubmitted,
  className = '',
}: {
  source?: string | null;
  intakeChannel?: string | null;
  orderFormSubmitted?: boolean;
  className?: string;
}) {
  const platform = formatInquiryLeadPlatformLabel(source);
  const channel = formatInquiryIntakeChannelLabel(intakeChannel, {
    source,
    orderFormSubmitted,
  });
  return (
    <span className={className}>
      <span>유입: {platform}</span>
      <span className="text-slate-400"> · </span>
      <span>접수 경로: {channel}</span>
    </span>
  );
}
