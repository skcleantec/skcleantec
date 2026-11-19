import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SoomgoMessagePresetDto, SoomgoMessageStep } from '@shared/soomgoMessagePresets';
import {
  fetchTelecrmSoomgoMessagePresets,
  fetchTelecrmSoomgoPresetUseStates,
  markTelecrmSoomgoPresetUsed,
  type SoomgoPresetUseState,
} from '../../api/telecrmSoomgoMessagePresets';
import { getToken } from '../../stores/auth';
import { Button } from '../ui/Button';
import { QuoteBottomBar, QuoteChip, quoteBottomButton, quoteCard } from './quoteChrome';
import { copyQuoteText, saveQuoteImages } from './quoteClipboard';
import { compactSearch, highlightParts } from './quotePhraseSearch';
import { QuoteMyPhraseSheet } from './QuoteMyPhraseSheet';

type Chip = 'all' | 'favorite' | 'personal' | 'shared' | 'recent';

type Row = SoomgoMessagePresetDto & SoomgoPresetUseState;

const CHIPS: { value: Chip; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'favorite', label: '⭐즐겨찾기' },
  { value: 'personal', label: '개인' },
  { value: 'shared', label: '공용' },
  { value: 'recent', label: '최근 쓴' },
];

function firstLine(steps: SoomgoMessageStep[]): string {
  for (const step of steps) {
    if (step.type !== 'text') continue;
    const line = step.text.split('\n').map((part) => part.trim()).find(Boolean);
    if (line) return line;
  }
  if (steps.some((step) => step.type === 'images')) return '사진';
  return '';
}

function searchHay(preset: SoomgoMessagePresetDto): string {
  const texts = preset.steps.flatMap((step) => (step.type === 'text' ? [step.text] : []));
  return compactSearch(`${preset.label} ${texts.join(' ')}`);
}

function copyLabel(steps: SoomgoMessageStep[], index: number): string {
  const step = steps[index] ?? steps[0];
  if (!step) return '복사';
  if (step.type === 'images') return '사진 저장';
  const textCount = steps.filter((item) => item.type === 'text').length;
  if (textCount <= 1) return '복사';
  let seen = 0;
  for (let i = 0; i <= index && i < steps.length; i += 1) {
    if (steps[i]?.type === 'text') seen += 1;
  }
  return `${Math.max(seen, 1)}/${textCount}`;
}

function Marked({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, index) =>
        part.hit ? (
          <mark key={index} className="bg-yellow-200 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function QuoteMyPhrasesTab({
  canEditShared,
  onToast,
}: {
  canEditShared: boolean;
  onToast: (message: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<Chip>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [editor, setEditor] = useState<Row | null | 'new'>(null);
  const holdTimer = useRef<number | null>(null);
  const held = useRef(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [presetRes, states] = await Promise.all([
        fetchTelecrmSoomgoMessagePresets(token, { scope: 'work' }),
        fetchTelecrmSoomgoPresetUseStates(token),
      ]);
      const byId = new Map(states.map((state) => [state.presetId, state]));
      setRows(
        presetRes.presets
          .filter((preset) => !preset.triggerKind)
          .map((preset) => ({
            ...preset,
            presetId: preset.id,
            favorite: byId.get(preset.id)?.favorite ?? false,
            useCount: byId.get(preset.id)?.useCount ?? 0,
            lastUsedAt: byId.get(preset.id)?.lastUsedAt ?? null,
          })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message.replaceAll('프리셋', '문구') : '문구를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = compactSearch(query);
    const filtered = rows.filter((row) => {
      if (chip === 'favorite' && !row.favorite) return false;
      if (chip === 'personal' && row.ownerScope !== 'personal') return false;
      if (chip === 'shared' && row.ownerScope !== 'shared') return false;
      if (chip === 'recent' && !row.lastUsedAt) return false;
      if (needle && !searchHay(row).includes(needle)) return false;
      return true;
    });
    const usedAt = (row: Row) => (row.lastUsedAt ? Date.parse(row.lastUsedAt) : 0);
    return filtered.sort((a, b) => {
      if (chip === 'recent') return usedAt(b) - usedAt(a);
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      if (a.useCount !== b.useCount) return b.useCount - a.useCount;
      return usedAt(b) - usedAt(a);
    });
  }, [chip, query, rows]);

  const clearHold = () => {
    if (holdTimer.current != null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const openEditor = (row: Row) => {
    const mine = row.ownerScope === 'personal' || canEditShared;
    if (!mine) {
      onToast('공용 문구는 설정을 바꿀 수 있는 사람만 수정해요.');
      return;
    }
    setEditor(row);
  };

  const copyStep = async (row: Row) => {
    const index = progress[row.id] ?? 0;
    const step = row.steps[index];
    if (!step) return;
    let ok = false;
    if (step.type === 'text') ok = await copyQuoteText(step.text);
    else {
      const saved = await saveQuoteImages(step.urls);
      ok = saved === 'shared' || saved === 'opened';
    }
    if (!ok) {
      onToast('복사하지 못했어요. 펼쳐서 내용을 길게 눌러 주세요.');
      return;
    }
    if (index === 0) {
      const token = getToken();
      if (token) {
        void markTelecrmSoomgoPresetUsed(token, row.id)
          .then((state) => {
            setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, ...state, presetId: row.id } : item)));
          })
          .catch(() => undefined);
      }
    }
    setProgress((prev) => ({
      ...prev,
      [row.id]: index + 1 >= row.steps.length ? 0 : index + 1,
    }));
    onToast(`「${row.label}」 복사했어요`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pb-24 pt-2">
      <input
        value={query}
        placeholder="이름, 내용"
        className={`w-full px-3 py-2 text-fluid-sm outline-none ${quoteCard}`}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="mt-2 flex gap-1 overflow-x-auto">
        {CHIPS.map((item) => (
          <QuoteChip key={item.value} label={item.label} on={chip === item.value} onClick={() => setChip(item.value)} />
        ))}
      </div>
      <p className="py-1 text-fluid-2xs text-slate-500">{loading ? '불러오는 중' : `${visible.length}건`}</p>
      {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}
      {!loading && visible.length === 0 ? <p className="py-6 text-center text-fluid-xs text-slate-500">맞는 문구가 없어요.</p> : null}
      {visible.length > 0 ? (
        <div className={`divide-y divide-[#e6ebf2] ${quoteCard}`}>
          {visible.map((row) => {
            const open = openId === row.id;
            const preview = firstLine(row.steps);
            const meta = ` · ${row.ownerScope === 'shared' ? '공용' : '개인'}${row.steps.length > 1 ? ` · 문구 ${row.steps.length}개` : ''}`;
            return (
              <div key={row.id}>
                <div className="flex items-start gap-1 px-2 py-2">
                  <span className="w-4 shrink-0 pt-0.5 text-center text-fluid-2xs">{row.favorite ? '⭐' : ''}</span>
                  <Button
                    variant="quiet"
                    size="sm"
                    nowrap={false}
                    className="!h-auto min-w-0 flex-1 !items-start !justify-start !rounded-none !border-0 !bg-transparent !px-0 !py-0 !text-left !leading-snug !shadow-none"
                    onClick={() => {
                      if (held.current) {
                        held.current = false;
                        return;
                      }
                      setOpenId((prev) => (prev === row.id ? null : row.id));
                    }}
                    onPointerDown={() => {
                      clearHold();
                      held.current = false;
                      holdTimer.current = window.setTimeout(() => {
                        held.current = true;
                        openEditor(row);
                      }, 500);
                    }}
                    onPointerUp={clearHold}
                    onPointerLeave={clearHold}
                    onPointerCancel={clearHold}
                  >
                    <span className="block w-full min-w-0">
                      <span className="flex min-w-0 items-baseline">
                        <span className="truncate text-fluid-sm font-semibold text-slate-900">
                          <Marked text={row.label} query={query} />
                        </span>
                        <span className="shrink-0 text-fluid-2xs text-slate-500">{meta}</span>
                      </span>
                      <span className="block truncate text-fluid-2xs text-slate-600">
                        <Marked text={preview} query={query} />
                      </span>
                    </span>
                  </Button>
                  <Button variant="secondary" size="sm" className="shrink-0" onClick={() => void copyStep(row)}>
                    {copyLabel(row.steps, progress[row.id] ?? 0)}
                  </Button>
                </div>
                {open ? (
                  <div className="space-y-2 px-3 pb-2">
                    {row.steps.map((step, index) =>
                      step.type === 'text' ? (
                        <p key={index} className="whitespace-pre-wrap text-fluid-xs text-slate-800">
                          {step.text}
                        </p>
                      ) : (
                        <Button key={index} variant="secondary" size="sm" onClick={() => void saveQuoteImages(step.urls)}>
                          사진 저장
                        </Button>
                      ),
                    )}
                    <Button variant="quiet" size="sm" onClick={() => openEditor(row)}>
                      수정
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      <QuoteBottomBar>
        <Button variant="primary" size="md" className={quoteBottomButton} onClick={() => setEditor('new')}>
          + 새 문구
        </Button>
      </QuoteBottomBar>
      {editor != null ? (
        <QuoteMyPhraseSheet
          preset={editor === 'new' ? null : editor}
          favorite={editor === 'new' ? false : editor.favorite}
          canEditShared={canEditShared}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
