import { useEffect, useState } from 'react';
import { searchPlatformPayInquiries, type PlatformPayInquiryHit } from '../../../api/platformCardPayment';
import { INPUT_BASE } from '../../../utils/platformUi';

export function PlatformPayInquiryPick({
  tenantId,
  inquiryId,
  onChange,
}: {
  tenantId: string;
  inquiryId: string;
  onChange: (id: string, label: string) => void;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PlatformPayInquiryHit[]>([]);
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!tenantId || q.trim().length < 1) {
      setItems([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void searchPlatformPayInquiries(tenantId, q.trim())
        .then(setItems)
        .catch(() => setItems([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [tenantId, q]);

  return (
    <div className="space-y-1">
      <label className="block text-xs text-gray-600">
        접수 건 (선택)
        <input
          className={`${INPUT_BASE} mt-1`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="고객명·주소"
          disabled={!tenantId}
        />
      </label>
      {label && inquiryId ? <p className="text-xs text-gray-700">{label}</p> : null}
      {items.length > 0 ? (
        <ul className="overflow-hidden rounded-lg border border-gray-200">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full px-2 py-2 text-left text-xs text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:pointer-events-none disabled:opacity-50"
                onClick={() => {
                  onChange(item.id, item.label);
                  setLabel(item.label);
                  setItems([]);
                  setQ('');
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
