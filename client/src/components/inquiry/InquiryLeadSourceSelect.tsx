import { useEffect, useState } from 'react';
import { getToken } from '../../stores/auth';
import { listInquiryLeadSources, type InquiryLeadSourceOption } from '../../api/inquiryLeadSources';

export function InquiryLeadSourceSelect({
  value,
  onChange,
  required,
  disabled,
  className = '',
  id,
  placeholder = '유입 경로 선택',
  'aria-label': ariaLabel = '유입 경로',
}: {
  value: string;
  onChange: (label: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
  'aria-label'?: string;
}) {
  const token = getToken();
  const [items, setItems] = useState<InquiryLeadSourceOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listInquiryLeadSources(token)
      .then((r) => {
        if (!cancelled) setItems(r.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <select
      id={id}
      aria-label={ariaLabel}
      className={className}
      value={value}
      disabled={disabled || loading}
      required={required}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{loading ? '불러오는 중…' : placeholder}</option>
      {value && !items.some((o) => o.label === value) ? (
        <option value={value}>{value} (기존)</option>
      ) : null}
      {items.map((o) => (
        <option key={o.id} value={o.label}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
