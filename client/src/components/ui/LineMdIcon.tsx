import { Icon } from '@iconify/react';

type LineMdIconProps = {
  /** Iconify `line-md` 이름. 접두어 `line-md:` 없이 — 예: `map-marker` */
  name: string;
  className?: string;
  title?: string;
};

/** [Material Line Icons](https://icon-sets.iconify.design/line-md) */
export function LineMdIcon({ name, className, title }: LineMdIconProps) {
  return (
    <span title={title} className="inline-flex shrink-0">
      <Icon icon={`line-md:${name}`} className={className} aria-hidden />
    </span>
  );
}
