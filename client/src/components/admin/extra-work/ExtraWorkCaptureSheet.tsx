import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseButton } from '../ModalCloseButton';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import {
  createExtraWork,
  fetchExtraWorkFormOptions,
  fetchExtraWorkList,
  type ExtraWorkItem,
} from '../../../api/extraWork';

const fieldClass =
  'min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';
const btnPrimary =
  'min-h-11 w-full rounded-lg bg-slate-900 px-4 text-fluid-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function won(n: number) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

export function ExtraWorkCaptureSheet(props: {
  open: boolean;
  token: string;
  inquiryId: string;
  customerName: string;
  onClose: () => void;
}) {
  const { open, token, inquiryId, customerName, onClose } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open, 160);
  const [presets, setPresets] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [marketers, setMarketers] = useState<{ id: string; name: string }[]>([]);
  const [canChoose, setCanChoose] = useState(false);
  const [marketerId, setMarketerId] = useState('');
  const [amount, setAmount] = useState('');
  const [chip, setChip] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [area, setArea] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [items, setItems] = useState<ExtraWorkItem[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setError('');
    setAmount('');
    setChip('');
    setCustomLabel('');
    setArea('');
    setPhotos([]);
    void Promise.all([
      fetchExtraWorkFormOptions(token, inquiryId),
      fetchExtraWorkList(token, { inquiryId }),
    ])
      .then(([options, list]) => {
        if (cancelled) return;
        setPresets(options.presets);
        setAreas(options.areas);
        setMarketers(options.marketers);
        setCanChoose(options.canChooseMarketer);
        setMarketerId(options.defaultMarketerId ?? '');
        setItems(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '추가 시공을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [inquiryId, open, token]);

  if (!open) return null;

  const submit = async () => {
    const amountWon = Number(amount.replace(/,/g, ''));
    const workLabel = customLabel.trim() || chip;
    if (!Number.isInteger(amountWon) || amountWon < 1) {
      setError('받은 금액을 1원 이상 적어 주세요.');
      return;
    }
    if (!workLabel) {
      setError('시공 내용을 골라 주세요.');
      return;
    }
    if (photos.length < 1) {
      setError('사진을 1장 이상 올려 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createExtraWork(token, {
        inquiryId,
        marketerId: canChoose ? marketerId : undefined,
        amountWon,
        workLabel,
        areaLabel: area,
        photos,
      });
      const list = await fetchExtraWorkList(token, { inquiryId });
      setItems(list);
      setAmount('');
      setChip('');
      setCustomLabel('');
      setArea('');
      setPhotos([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center">
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
            고객 집에서 받은 추가 금액입니다. 접수 잔금과는 따로 저장되고, 월정산표 추가정산에 반영됩니다.
          </p>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          {canChoose ? (
            <label className="block space-y-1">
              <span className="text-fluid-2xs text-slate-600">담당 마케터</span>
              <select className={fieldClass} value={marketerId} onChange={(e) => setMarketerId(e.target.value)}>
                <option value="">선택</option>
                {marketers.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block space-y-1">
            <span className="text-fluid-2xs text-slate-600">받은 금액</span>
            <input
              inputMode="numeric"
              className={fieldClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="원"
            />
          </label>
          <div className="space-y-1">
            <p className="text-fluid-2xs text-slate-600">시공 내용</p>
            <div className="flex flex-wrap gap-1">
              {presets.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setChip(label)}
                  className={`min-h-9 rounded-lg border px-2 text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                    chip === label ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-300 bg-white text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              className={fieldClass}
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="직접 입력"
            />
          </div>
          <label className="block space-y-1">
            <span className="text-fluid-2xs text-slate-600">공간 (선택)</span>
            <select className={fieldClass} value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">선택 안 함</option>
              {areas.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-fluid-2xs text-slate-600">사진 1장 이상</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="block w-full text-fluid-xs"
              onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 8))}
            />
            {photos.length > 0 ? <p className="text-fluid-2xs text-slate-500">{photos.length}장</p> : null}
          </label>
          <button type="button" className={btnPrimary} disabled={saving} onClick={() => void submit()}>
            {saving ? '저장 중…' : '추가 시공 저장'}
          </button>
          {items.length > 0 ? (
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-200 px-2.5 py-2 text-fluid-xs">
                  <p className="font-medium text-slate-900">
                    {item.workLabel}
                    {item.areaLabel ? ` · ${item.areaLabel}` : ''} · {won(item.amountWon)}
                  </p>
                  <p className="text-fluid-2xs text-slate-500">
                    {item.marketerName} · 사진 {item.photoCount}장 · 마케터 수령 {won(item.marketerWon)}
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
