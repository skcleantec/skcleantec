import {
  internalCustomerToneEmoji,
  type InternalCustomerTone,
} from '../../constants/internalCustomerTone';

type Props = {
  tone?: InternalCustomerTone | null;
  className?: string;
  title?: string;
};

/** 내부 전용 — 고객명 옆 😊/😐/😠 */
export function InternalCustomerToneEmoji({ tone, className = '', title }: Props) {
  const emoji = internalCustomerToneEmoji(tone);
  return (
    <span
      className={`shrink-0 leading-none select-none ${className}`.trim()}
      aria-hidden
      title={title}
    >
      {emoji}
    </span>
  );
}
