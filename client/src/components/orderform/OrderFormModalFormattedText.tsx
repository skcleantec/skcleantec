import { useMemo } from 'react';
import { orderFormModalTextToSafeHtml } from '../../utils/orderFormModalFormattedText';

export function OrderFormModalFormattedText({
  text,
  className = 'break-words leading-relaxed',
}: {
  text: string;
  className?: string;
}) {
  const html = useMemo(() => orderFormModalTextToSafeHtml(text), [text]);
  if (!html) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
