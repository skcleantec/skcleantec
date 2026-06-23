import {
  hasInternalCustomerToneDisplay,
  internalCustomerToneEmoji,
  internalCustomerToneHint,
  type InternalCustomerTone,
} from '../../constants/internalCustomerTone';

type Props = {
  tone?: InternalCustomerTone | null;
  className?: string;
  title?: string;
};

/** 내부 전용 — 고객명 옆 👼/😈/🧓 (미설정이면 렌더 안 함) */
export function InternalCustomerToneEmoji({ tone, className = '', title }: Props) {
  if (!hasInternalCustomerToneDisplay(tone)) return null;
  const emoji = internalCustomerToneEmoji(tone);
  if (!emoji) return null;
  const hint = title ?? internalCustomerToneHint(tone);
  return (
    <span
      className={`shrink-0 leading-none select-none ${className}`.trim()}
      aria-hidden={hint ? undefined : true}
      title={hint || undefined}
      role={hint ? 'img' : undefined}
      aria-label={hint || undefined}
    >
      {emoji}
    </span>
  );
}
