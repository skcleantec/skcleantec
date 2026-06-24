import {
  hasInternalCustomerToneDisplay,
  internalCustomerToneHint,
  internalCustomerToneImageSrc,
  type InternalCustomerTone,
} from '../../constants/internalCustomerTone';

type Props = {
  tone?: InternalCustomerTone | null;
  className?: string;
  title?: string;
  /** 목록·고객명 옆 기본 크기 */
  sizeClass?: string;
};

/** 내부 전용 — 고객명·폼 옆 내부고객 아이콘 (미설정이면 렌더 안 함) */
export function InternalCustomerToneIcon({
  tone,
  className = '',
  title,
  sizeClass = 'h-5 w-5',
}: Props) {
  if (!hasInternalCustomerToneDisplay(tone)) return null;
  const src = internalCustomerToneImageSrc(tone);
  if (!src) return null;
  const hint = title ?? internalCustomerToneHint(tone);
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={`inline-block shrink-0 object-contain select-none ${sizeClass} ${className}`.trim()}
      title={hint || undefined}
      aria-hidden={hint ? undefined : true}
      role={hint ? 'img' : undefined}
      aria-label={hint || undefined}
    />
  );
}
