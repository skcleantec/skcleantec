import { canShowInternalCustomerTone, type InternalCustomerTone } from '../../constants/internalCustomerTone';
import { InternalCustomerToneEmoji } from './InternalCustomerToneEmoji';

type Props = {
  name: string;
  tone?: InternalCustomerTone | null;
  viewerRole?: string | null;
  className?: string;
  nameClassName?: string;
};

/** 고객명 + (권한 있을 때만) 내부 이모티콘 */
export function CustomerNameWithInternalTone({
  name,
  tone,
  viewerRole,
  className = '',
  nameClassName = '',
}: Props) {
  const showTone = canShowInternalCustomerTone(viewerRole ?? undefined);
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${className}`.trim()}>
      <span className={`truncate ${nameClassName}`.trim()} title={name}>
        {name}
      </span>
      {showTone ? <InternalCustomerToneEmoji tone={tone} /> : null}
    </span>
  );
}
