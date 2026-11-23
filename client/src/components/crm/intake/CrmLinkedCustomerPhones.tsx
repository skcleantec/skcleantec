import { useEffect, useState } from 'react';
import { patchOrderFollowup } from '../../../api/orderFollowups';
import { getToken } from '../../../stores/auth';
import { resolveCrmStoredPhones } from '../../../utils/crmContactPhone';
import { crmFieldCompactClass } from '../crmUi';

const digits = (raw: string) => raw.replace(/\D/g, '');

/** 「기존」에서 불러온 부재·보류 고객의 번호를 고치는 칸 — 위의 찾기 칸과 따로 둔다 */
export function CrmLinkedCustomerPhones({
  followupId,
  linkKey,
  customerLabel,
  contactPhone,
  safePhone,
  onSaved,
}: {
  followupId: string;
  /** 다른 고객을 불러오면 바뀌는 값 — 적던 내용을 새 고객 번호로 되돌린다 */
  linkKey: number;
  customerLabel: string;
  contactPhone: string;
  safePhone: string;
  onSaved: (next: { contactPhone: string; safePhone: string }) => void;
}) {
  const [contact, setContact] = useState(contactPhone);
  const [safe, setSafe] = useState(safePhone);
  const [saved, setSaved] = useState({ contact: contactPhone, safe: safePhone });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setContact(contactPhone);
    setSafe(safePhone);
    setSaved({ contact: contactPhone, safe: safePhone });
    setNote(null);
    // 불러온 고객이 바뀔 때만 되돌린다 — 저장 뒤 부모 값이 바뀌는 것은 따라가지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followupId, linkKey]);

  const changed = digits(contact) !== digits(saved.contact) || digits(safe) !== digits(saved.safe);
  const empty = !digits(contact) && !digits(safe);

  const save = async () => {
    const token = getToken();
    if (!token || busy) return;
    if (empty) {
      setNote({ tone: 'err', text: '연락처나 안심번호 중 하나는 적어 주세요.' });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const stored = resolveCrmStoredPhones(contact, safe);
      await patchOrderFollowup(token, followupId, {
        customerPhone: stored.customerPhone,
        customerPhone2: stored.customerPhone2,
      });
      setSaved({ contact, safe });
      setNote({ tone: 'ok', text: '번호를 저장했어요.' });
      onSaved({ contactPhone: contact.trim(), safePhone: safe.trim() });
    } catch (e) {
      setNote({ tone: 'err', text: e instanceof Error ? e.message : '번호를 저장하지 못했어요.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2">
      <p className="text-fluid-2xs font-semibold text-slate-800">
        {customerLabel} 연락처 고치기
        <span className="ml-1 font-normal text-slate-500">위 찾기 칸과 따로 저장돼요</span>
      </p>
      <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1">
        <label htmlFor="crm-linked-contact" className="text-fluid-2xs text-slate-600">
          연락처
        </label>
        <input
          id="crm-linked-contact"
          type="tel"
          inputMode="tel"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="010-0000-0000"
          disabled={busy}
          className={`${crmFieldCompactClass} h-8 min-w-0 tabular-nums`}
        />
        <label htmlFor="crm-linked-safe" className="text-fluid-2xs text-slate-600">
          안심번호
        </label>
        <input
          id="crm-linked-safe"
          type="tel"
          inputMode="tel"
          value={safe}
          onChange={(e) => setSafe(e.target.value)}
          placeholder="0504-0000-0000"
          disabled={busy}
          className={`${crmFieldCompactClass} h-8 min-w-0 tabular-nums`}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        {note ? (
          <span className={`min-w-0 flex-1 text-fluid-2xs ${note.tone === 'ok' ? 'text-emerald-700' : 'text-red-600'}`} role="status">
            {note.text}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !changed}
          className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-lg bg-slate-900 px-3 text-fluid-2xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-40"
        >
          {busy ? '저장 중…' : '번호 저장'}
        </button>
      </div>
    </div>
  );
}
