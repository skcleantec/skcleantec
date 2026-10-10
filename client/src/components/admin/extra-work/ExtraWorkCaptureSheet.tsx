import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseButton } from '../ModalCloseButton';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import {
  createExtraWork,
  fetchExtraWorkFormOptions,
  fetchExtraWorkList,
  saveExtraWorkPresets,
  type ExtraWorkItem,
} from '../../../api/extraWork';
import { ExtraWorkLineCards, emptyDraftLine, type DraftLine } from './ExtraWorkLineCards';

const fieldClass =
  'min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';
const btnPrimary =
  'min-h-11 w-full rounded-lg bg-slate-900 px-4 text-fluid-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function won(n: number) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function lineCaption(item: ExtraWorkItem['lines'][number]) {
  const place = item.placeLabel ? ` ${item.placeLabel}` : '';
  const qty = item.quantity != null && item.unitLabel ? ` ${item.quantity}${item.unitLabel}` : '';
  const unit = item.unitPriceWon != null && item.unitLabel ? ` · ${item.unitLabel}당 ${won(item.unitPriceWon)}` : '';
  return `${item.workLabel}${place}${qty} · ${won(item.amountWon)}${unit}`;
}

export function ExtraWorkCaptureSheet(props: {
  open: boolean;
  token: string;
  inquiryId: string;
  customerName: string;
  assignedLeaders?: { id: string; name: string }[];
  assignedMarketer?: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const { open, token, inquiryId, customerName, assignedLeaders = [], assignedMarketer = null, onClose } = props;
  const assignedLeaderKey = assignedLeaders.map((row) => row.id).join('|');
  const assignedMarketerKey = assignedMarketer?.id ?? '';
  const assignedRef = useRef({ leaders: assignedLeaders, marketer: assignedMarketer });
  assignedRef.current = { leaders: assignedLeaders, marketer: assignedMarketer };
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open, 160);
  const [presets, setPresets] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>(['장', '개', 'm', '평', '식']);
  const [marketers, setMarketers] = useState<{ id: string; name: string }[]>(() =>
    assignedMarketer ? [assignedMarketer] : [],
  );
  const [teamLeaders, setTeamLeaders] = useState<{ id: string; name: string }[]>(assignedLeaders);
  const [canChoose, setCanChoose] = useState(false);
  const [marketerId, setMarketerId] = useState(assignedMarketer?.id ?? '');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState('');
  const [presetBusy, setPresetBusy] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>(() => [emptyDraftLine()]);
  const [items, setItems] = useState<ExtraWorkItem[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setError('');
    setCatalogOpen(false);
    setDraftPreset('');
    setLines([emptyDraftLine()]);
    void Promise.all([fetchExtraWorkFormOptions(token, inquiryId), fetchExtraWorkList(token, { inquiryId })])
      .then(([options, list]) => {
        if (cancelled) return;
        setPresets(options.presets);
        setAreas(options.areas);
        if (options.units.length > 0) setUnits(options.units);
        const knownMarketer = assignedRef.current.marketer;
        const knownLeaders = assignedRef.current.leaders;
        const nextMarketers = [...options.marketers];
        if (knownMarketer && !nextMarketers.some((row) => row.id === knownMarketer.id)) {
          nextMarketers.unshift(knownMarketer);
        }
        setMarketers(nextMarketers);
        const nextLeaders = options.teamLeaders ?? [];
        setTeamLeaders(nextLeaders.length > 0 ? nextLeaders : knownLeaders);
        setCanChoose(options.canChooseMarketer);
        setMarketerId(options.defaultMarketerId || knownMarketer?.id || '');
        setItems(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '추가 시공을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [assignedLeaderKey, assignedMarketerKey, inquiryId, open, token]);

  if (!open) return null;

  const changePresets = async (next: string[]) => {
    setPresetBusy(true);
    setError('');
    try {
      const saved = await saveExtraWorkPresets(token, next);
      setPresets(saved);
      setLines((current) => current.map((line) => (saved.includes(line.workLabel) ? line : { ...line, workLabel: '' })));
      return saved;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '시공 종류를 저장하지 못했습니다.');
      return null;
    } finally {
      setPresetBusy(false);
    }
  };

  const addPreset = () => {
    const label = draftPreset.trim().replace(/\s+/g, ' ');
    if (!label) {
      setError('시공 종류를 적어 주세요.');
      return;
    }
    if (presets.includes(label)) {
      setDraftPreset('');
      return;
    }
    void changePresets([...presets, label]).then((saved) => {
      if (!saved?.includes(label)) return;
      setDraftPreset('');
    });
  };

  const submit = async () => {
    const payload = lines.map((line) => ({
      workLabel: line.workLabel,
      placeLabel: line.placeLabel,
      quantity: line.quantity ? Number(line.quantity) : null,
      unitLabel: line.quantity ? line.unitLabel : '',
      amountWon: Number(line.amount.replace(/,/g, '')),
      photos: line.photos,
    }));
    if (payload.some((line) => !line.workLabel)) {
      setError('시공마다 종류를 골라 주세요.');
      return;
    }
    if (payload.some((line) => !Number.isInteger(line.amountWon) || line.amountWon < 1)) {
      setError('시공 금액을 1원 이상 적어 주세요.');
      return;
    }
    if (payload.some((line) => line.photos.length < 1)) {
      setError('시공마다 사진을 1장 이상 올려 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createExtraWork(token, {
        inquiryId,
        marketerId: canChoose ? marketerId : undefined,
        lines: payload,
      });
      const list = await fetchExtraWorkList(token, { inquiryId });
      setItems(list);
      setLines([emptyDraftLine(units[0] || '장')]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[580] flex items-end justify-center bg-slate-900/40 sm:items-center">
      <div
        className="modal-mobile-fullscreen-panel flex h-[100dvh] w-full max-w-lg flex-col bg-white sm:h-auto sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extra-work-title"
      >
        <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 pr-12">
          <h2 id="extra-work-title" className="truncate text-fluid-sm font-semibold text-slate-900">
            추가 시공 · {customerName}
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div
          ref={scrollRef}
          className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
          onFocusCapture={onFieldFocus}
        >
          <p className="text-fluid-2xs leading-snug text-slate-600">
            한 집에서 시공마다 위치, 수량, 금액, 사진을 따로 적습니다. 합계가 월정산표 추가정산에 반영됩니다.
          </p>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          <label className="block space-y-1">
            <span className="text-fluid-2xs text-slate-600">담당 마케터</span>
            {canChoose ? (
              <select className={fieldClass} value={marketerId} onChange={(e) => setMarketerId(e.target.value)}>
                {marketers.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className={`${fieldClass} flex items-center bg-slate-50 text-slate-800`}>
                {marketers.find((row) => row.id === marketerId)?.name || marketers[0]?.name || ''}
              </p>
            )}
          </label>
          <div className="block space-y-1">
            <span className="text-fluid-2xs text-slate-600">담당 팀장</span>
            <p className={`${fieldClass} flex items-center bg-slate-50 text-slate-800`}>
              {teamLeaders.length > 0 ? teamLeaders.map((row) => row.name).join(', ') : '배정 없음'}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-fluid-2xs text-slate-600">시공 종류</p>
              <button
                type="button"
                aria-expanded={catalogOpen}
                onClick={() => setCatalogOpen((current) => !current)}
                className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-slate-300 bg-white px-2 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                시공종류 +
              </button>
            </div>
            <p className="text-fluid-2xs leading-snug text-slate-500">종류는 여기서 넣고 지웁니다. 시공 1, 시공 2에서 종류를 고릅니다.</p>
            {catalogOpen ? (
              <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-fluid-2xs leading-snug text-slate-500">
                  여기서 종류를 넣거나 지우면 이 업체 목록이 바뀝니다. 이미 저장된 건의 이름은 그대로입니다.
                </p>
                <div className="flex flex-wrap gap-1">
                  {presets.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-fluid-xs text-slate-800"
                    >
                      {label}
                      <button
                        type="button"
                        disabled={presetBusy}
                        aria-label={`${label} 삭제`}
                        onClick={() => void changePresets(presets.filter((item) => item !== label))}
                        className="min-h-9 rounded-lg px-1.5 text-fluid-2xs text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    className={fieldClass}
                    value={draftPreset}
                    maxLength={40}
                    onChange={(e) => setDraftPreset(e.target.value)}
                    placeholder="시공 종류 추가"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addPreset();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={presetBusy}
                    onClick={addPreset}
                    className="min-h-10 shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  >
                    추가
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <ExtraWorkLineCards lines={lines} presets={presets} places={areas} units={units} onChange={setLines} />
          <button type="button" className={btnPrimary} disabled={saving} onClick={() => void submit()}>
            {saving ? '저장 중…' : '추가 시공 저장'}
          </button>
          {items.length > 0 ? (
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-200 px-2.5 py-2 text-fluid-xs">
                  <p className="font-medium text-slate-900">합계 {won(item.amountWon)}</p>
                  {(item.lines ?? []).map((line, index) => (
                    <p key={`${item.id}-${index}`} className="text-slate-800">
                      {lineCaption(line)}
                    </p>
                  ))}
                  {(item.lines ?? []).length === 0 ? <p className="text-slate-800">{item.workLabel}</p> : null}
                  <p className="truncate text-fluid-2xs text-slate-500" title={item.photoNames.join(', ')}>
                    {item.marketerName} · 사진 {item.photoCount}장
                    {item.photoNames.length > 0 ? ` · ${item.photoNames.join(', ')}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
