import type { InternalCustomerTone } from '../../constants/internalCustomerTone';
import { InternalCustomerToneIcon } from './InternalCustomerToneIcon';

type Props = {
  tone?: InternalCustomerTone | null;
  className?: string;
  title?: string;
};

/** 내부 전용 — 고객명 옆 내부고객 아이콘 (미설정이면 렌더 안 함) */
export function InternalCustomerToneEmoji({ tone, className = '', title }: Props) {
  return <InternalCustomerToneIcon tone={tone} className={className} title={title} />;
}
