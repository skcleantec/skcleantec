import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchExtraWorkSettings,
  saveExtraWorkAdjustment,
  searchExtraWorkInquiries,
  type ExtraWorkItem,
  type ExtraWorkSettlementKind,
} from '../../../api/extraWork';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { ModalCloseButton } from '../ModalCloseButton';

const fieldClass =
  'min-h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-fluid-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

type InquiryHit = {
  id: string;
  customerName: string;
  inquiryNumber: string | null;
  teamLeaders: Array<{ id: string; name: string }>;
};

function kstYmd(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function magnitude(item: ExtraWorkItem) {
  if (item.settlementKind === 'COMPANY_SUPPORT') return Math.abs(item.companyWon);
  return Math.abs(item.amountWon);
}

export function ExtraSettlementAdjustSheet(props: {
  token: string;
  month: string;
  open: boolean;
  item: ExtraWorkItem | null;
  leaders: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { token, month, open, item, leaders, onClose, onSaved } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open, 160);
  const [kind, setKind] = useState<ExtraWorkSettlementKind>('REFUND');
  const [amount, setAmount] = useState('');
  const [occurredOn, setOccurredOn] = useState('');
  const [note, setNote] = useState('');
  const [marketerId, setMarketerId] = useState('');
  const [teamLeaderId, setTeamLeaderId] = useState('');
  const [inquiryId, setInquiryId] = useState('');
  const [inquiryLabel, setInquiryLabel] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<InquiryHit[]>([]);
  const [marketers, setMarketers] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = kstYmd(new Date().toISOString());
    const fallback = today.startsWith(month) ? today : `${month}-01`;
    setKind(item?.settlementKind === 'COMPANY_SUPPORT' ? 'COMPANY_SUPPORT' : item?.settlementKind === 'NORMAL' ? 'REFUND' : item?.settlementKind ?? 'REFUND');
    setAmount(item ? String(magnitude(item)) : '');
    setOccurredOn(item ? kstYmd(item.occurredAt) : fallback);
    setNote(item?.workLabel ?? '');
    setMarketerId(item?.marketerId ?? '');
    setTeamLeaderId(item?.leaderShares[0]?.teamLeaderId ?? '');
    setInquiryId(item?.inquiryId ?? '');
    setInquiryLabel(item ? `${item.customerName}${item.inquiryNumber ? ` · ${item.inquiryNumber}` : ''}` : '');
    setQuery('');
    setHits([]);
    setError('');
  }, [item, month, open]);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    void fetchExtraWorkSettings(token)
      .then((settings) => {
        if (!cancelled) setMarketers(settings.marketers.map((row) => ({ id: row.id, name: row.name })));
      })
      .catch(() => {
        if (!cancelled) setMarketers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  useEffect(() => {
    if (!open || query.trim().length < 1) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchExtraWorkInquiries(token, query.trim())
        .then((rows) => {
          if (!cancelled) setHits(rows);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query, token]);

  const save = async () => {
    const amountWon = Number(amount.replace(/,/g, ''));
    if (!inquiryId) {
      setError('접수를 골라 주세요.');
      return;
    }
    if (!marketerId) {
      setError('마케터를 골라 주세요.');
      return;
    }
    if (!occurredOn.startsWith(month)) {
      setError('날짜는 이 달 안으로 골라 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveExtraWorkAdjustment(token, {
        recordId: item?.id,
        inquiryId,
        marketerId,
        teamLeaderId: teamLeaderId || null,
        kind,
        amountWon,
        occurredOn,
        note,
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  const kinds: Array<{ id: ExtraWorkSettlementKind; label: string }> = [
    { id: 'REFUND', label: '환불' },
    { id: 'COMPANY_SUPPORT', label: '회사 지원' },
    ...(item ? [{ id: 'NORMAL' as const, label: '정상' }] : []),
  ];

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="닫기" onClick={onClose} />
      <div
        className="modal-mobile-fullscreen-panel relative z-10 flex h-[100dvh] w-full max-w-lg flex-col bg-white sm:h-auto sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extra-adjust-title"
      >
        <div className="relative flex shrink-0 items-center border-b border-slate-200 px-3 py-2 pr-12">
          <h2 id="extra-adjust-title" className="truncate text-fluid-sm font-semibold text-slate-900">
            {item ? '추가정산 수정' : '환불·회사 지원'}
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div
          ref={scrollRef}
          className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
          onFocusCapture={onFieldFocus}
        >
          <div className="flex flex-wrap gap-1">
            {kinds.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setKind(option.id)}
                className={`min-h-9 rounded-lg px-3 text-fluid-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                  kind === option.id ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-fluid-2xs leading-snug text-slate-600">
            {kind === 'COMPANY_SUPPORT'
              ? '회사가 보태는 금액입니다. 팀장을 고르면 그 칸에 들어가고, 비우면 마케터에게 들어갑니다.'
              : kind === 'REFUND'
                ? '시공은 했는데 돈을 못 받은 금액입니다. 마케터 비율대로 몫이 빠집니다.'
                : '받은 추가 시공으로 되돌립니다.'}
          </p>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          <label className="block space-y-1">
            <span className="text-fluid-2xs text-slate-600">접수</span>
            <input
              className={fieldClass}
              value={query}
              placeholder={inquiryLabel || '이름 또는 접수번호'}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {inquiryLabel && !query ? <p className="text-fluid-2xs text-slate-700">{inquiryLabel}</p> : null}
          {hits.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {hits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  onClick={() => {
                    setInquiryId(hit.id);
                    setInquiryLabel(`${hit.customerName}${hit.inquiryNumber ? ` · ${hit.inquiryNumber}` : ''}`);
                    setTeamLeaderId(hit.teamLeaders[0]?.id ?? '');
                    setQuery('');
                    setHits([]);
                  }}
                  className="block w-full truncate px-2 py-2 text-left text-fluid-xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  {hit.customerName}
                  {hit.inquiryNumber ? ` · ${hit.inquiryNumber}` : ''}
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-fluid-2xs text-slate-600">날짜</span>
              <input className={fieldClass} type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-fluid-2xs text-slate-600">금액</span>
              <input className={`${fieldClass} tabular-nums`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-fluid-2xs text-slate-600">내용</span>
            <input className={fieldClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-fluid-2xs text-slate-600">마케터</span>
              <select className={fieldClass} value={marketerId} onChange={(e) => setMarketerId(e.target.value)}>
                <option value="">선택</option>
                {marketers.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-fluid-2xs text-slate-600">팀장</span>
              <select className={fieldClass} value={teamLeaderId} onChange={(e) => setTeamLeaderId(e.target.value)}>
                <option value="">없음</option>
                {leaders.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="min-h-10 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
