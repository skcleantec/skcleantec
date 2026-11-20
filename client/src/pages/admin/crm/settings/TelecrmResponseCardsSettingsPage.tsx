import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getToken } from '../../../../stores/auth';
import { useCrmWorkBrand } from '../../../../hooks/useCrmWorkBrand';
import {
  fetchTelecrmResponseSearchGaps,
  importTelecrmResponseCards,
  listTelecrmResponseCards,
  patchTelecrmResponseCard,
  type TelecrmResponseCardDto,
  type TelecrmResponseCardImportItem,
  type TelecrmResponseCardStatus,
} from '../../../../api/telecrmResponseCards';
import { SettingsCard } from '../../../../components/crm/settings/DeletePasswordModal';

type View = TelecrmResponseCardStatus | 'gaps';

const VIEWS: { value: View; label: string }[] = [
  { value: 'draft', label: '승인 대기' },
  { value: 'approved', label: '사용 중' },
  { value: 'archived', label: '보관' },
  { value: 'gaps', label: '카드 없던 검색' },
];

function lines(v: string): string[] {
  return v
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 「스타일: 문장」 한 줄씩 */
function parseResponses(v: string): [string, string][] {
  return lines(v).map((line) => {
    const at = line.indexOf(':');
    if (at > 0 && at < 12) return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    return ['답', line];
  });
}

export function TelecrmResponseCardsSettingsPage() {
  const token = getToken();
  const { activeOperatingCompanyId, active, loading: brandLoading } = useCrmWorkBrand();
  const [view, setView] = useState<View>('draft');
  const [items, setItems] = useState<TelecrmResponseCardDto[]>([]);
  const [gaps, setGaps] = useState<{ q: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TelecrmResponseCardDto | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!token || brandLoading) return;
    setLoading(true);
    setError(null);
    try {
      if (view === 'gaps') {
        const res = await fetchTelecrmResponseSearchGaps(token);
        setGaps(res.items ?? []);
      } else {
        const res = await listTelecrmResponseCards(token, view, activeOperatingCompanyId);
        setItems(res.items ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [token, brandLoading, view, activeOperatingCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const f = filter.trim();
    if (!f) return items;
    return items.filter((c) =>
      [c.code, c.title, c.category, ...c.triggers, ...c.responses.map((r) => r[1])].some((t) => t.includes(f)),
    );
  }, [items, filter]);

  const setStatus = async (ids: string[], status: TelecrmResponseCardStatus) => {
    if (!token || ids.length === 0) return;
    setBusy(true);
    setNotice(null);
    let done = 0;
    try {
      for (const id of ids) {
        await patchTelecrmResponseCard(token, id, { status, operatingCompanyId: activeOperatingCompanyId });
        done += 1;
      }
      setNotice(
        status === 'approved' ? `${done}장을 승인했어요.` : status === 'archived' ? `${done}장을 보관했어요.` : `${done}장을 승인 대기로 돌렸어요.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '바꾸지 못했어요.');
      if (done) await load();
    } finally {
      setBusy(false);
    }
  };

  const onImport = async (file: File) => {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const parsed = JSON.parse(await file.text()) as TelecrmResponseCardImportItem[] | { cards: TelecrmResponseCardImportItem[] };
      const cards = Array.isArray(parsed) ? parsed : parsed.cards;
      if (!Array.isArray(cards) || cards.length === 0) throw new Error('카드가 없는 파일이에요.');
      const res = await importTelecrmResponseCards(token, cards, activeOperatingCompanyId);
      setNotice(`새 카드 ${res.created}장, 고친 카드 ${res.updated}장을 불러왔어요. 승인 대기에서 확인해 주세요.`);
      setView('draft');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했어요.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const tabBtn = (v: { value: View; label: string }) => (
    <button
      key={v.value}
      type="button"
      onClick={() => {
        setView(v.value);
        setOpenId(null);
      }}
      className={`rounded-lg px-3 py-1.5 text-fluid-xs font-semibold ${
        view === v.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {v.label}
    </button>
  );

  return (
    <div className="space-y-4">
      <SettingsCard
        title={`대응 카드${active?.name ? ` · ${active.name}` : ''}`}
        actions={
          <div className="flex items-center gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-fluid-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              카드 파일 불러오기
            </button>
          </div>
        }
      >
        <p className="text-fluid-xs text-slate-500">
          상담 스크립트 검색창에 고객 말을 치면 「사용 중」 카드만 나옵니다. 새 카드와 고친 카드는 승인 대기에서 확인한 뒤 승인해 주세요.
        </p>
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 pb-2">
          {VIEWS.map(tabBtn)}
          {view !== 'gaps' ? (
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="카드 찾기"
              className="ml-auto h-8 w-44 rounded-lg border border-slate-200 px-2.5 text-fluid-xs focus:border-slate-400 focus:outline-none"
            />
          ) : null}
        </div>

        {notice ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-fluid-xs text-emerald-800">{notice}</p> : null}
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-fluid-xs text-red-700">{error}</p> : null}

        {loading ? (
          <p className="text-fluid-xs text-slate-500">불러오는 중…</p>
        ) : view === 'gaps' ? (
          gaps.length === 0 ? (
            <p className="text-fluid-xs text-slate-500">최근 7일 동안 카드 없이 끝난 검색이 없어요.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {gaps.map((g) => (
                <li key={g.q} className="flex items-center justify-between px-3 py-2 text-fluid-xs">
                  <span className="font-semibold text-slate-800">「{g.q}」</span>
                  <span className="text-slate-500">{g.count}번 검색</span>
                </li>
              ))}
            </ul>
          )
        ) : shown.length === 0 ? (
          <p className="text-fluid-xs text-slate-500">
            {view === 'draft' ? '승인을 기다리는 카드가 없어요.' : view === 'approved' ? '사용 중인 카드가 없어요.' : '보관한 카드가 없어요.'}
          </p>
        ) : (
          <>
            {view === 'draft' ? (
              <div className="flex items-center justify-between">
                <span className="text-fluid-xs text-slate-500">{shown.length}장</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setStatus(shown.map((c) => c.id), 'approved')}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-fluid-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy ? '처리 중…' : `보이는 ${shown.length}장 모두 승인`}
                </button>
              </div>
            ) : (
              <span className="text-fluid-xs text-slate-500">{shown.length}장</span>
            )}
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {shown.map((c) => {
                const open = openId === c.id;
                return (
                  <li key={c.id} className="bg-white">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : c.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        aria-expanded={open}
                      >
                        <span className="w-11 shrink-0 text-fluid-2xs tabular-nums text-slate-400">{c.code}</span>
                        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600">
                          {c.category}
                        </span>
                        <span className="min-w-0 truncate text-fluid-xs font-semibold text-slate-900">{c.title}</span>
                        {c.wonInCall ? <span className="shrink-0 text-[10.5px] font-bold text-emerald-700">★ 예약 성사</span> : null}
                      </button>
                      {view === 'approved' ? (
                        <span className="hidden shrink-0 text-[10.5px] text-slate-400 sm:inline">
                          복사 {c.useCount ?? 0} · 👍 {c.upCount ?? 0} · 👎 {c.downCount ?? 0}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-fluid-2xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        고치기
                      </button>
                      {view !== 'approved' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void setStatus([c.id], 'approved')}
                          className="shrink-0 rounded-lg bg-slate-900 px-2 py-1 text-fluid-2xs font-semibold text-white disabled:opacity-50"
                        >
                          승인
                        </button>
                      ) : null}
                      {view !== 'archived' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void setStatus([c.id], 'archived')}
                          className="shrink-0 rounded-lg px-2 py-1 text-fluid-2xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                        >
                          보관
                        </button>
                      ) : null}
                    </div>
                    {open ? (
                      <div className="space-y-1.5 border-t border-slate-100 bg-slate-50/60 px-3 py-2 text-fluid-xs text-slate-700">
                        {c.triggers.length ? <p>고객이 이렇게 말하면: {c.triggers.map((t) => `「${t}」`).join(' · ')}</p> : null}
                        {c.responses.map(([st, t], i) => (
                          <p key={`${st}-${i}`}>
                            <b className="text-[#6d28d9]">{st}</b> · {t}
                          </p>
                        ))}
                        {c.avoid.length ? <p className="text-red-700">피할 말: {c.avoid.join(' · ')}</p> : null}
                        {c.rule ? <p className="text-amber-800">기준: {c.rule}</p> : null}
                        {c.sources.length ? <p className="text-slate-400">근거: {c.sources.join(', ')}</p> : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </SettingsCard>

      {editing ? (
        <CardEditModal
          card={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            if (!token) return;
            setBusy(true);
            try {
              await patchTelecrmResponseCard(token, editing.id, { ...patch, operatingCompanyId: activeOperatingCompanyId });
              setEditing(null);
              setNotice('카드를 고쳤어요.');
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : '저장하지 못했어요.');
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function CardEditModal({
  card,
  busy,
  onClose,
  onSave,
}: {
  card: TelecrmResponseCardDto;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: Partial<TelecrmResponseCardDto>) => Promise<void>;
}) {
  const [title, setTitle] = useState(card.title);
  const [category, setCategory] = useState(card.category);
  const [triggers, setTriggers] = useState(card.triggers.join('\n'));
  const [responses, setResponses] = useState(card.responses.map(([s, t]) => `${s}: ${t}`).join('\n'));
  const [avoid, setAvoid] = useState(card.avoid.join('\n'));
  const [rule, setRule] = useState(card.rule);
  const [won, setWon] = useState(card.wonInCall);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const field = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-fluid-xs focus:border-slate-400 focus:outline-none';
  const label = 'mb-1 block text-fluid-2xs font-semibold text-slate-500';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="대응 카드 고치기">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-fluid-sm font-bold text-slate-900">
            {card.code} 카드 고치기
          </p>
          <button type="button" onClick={onClose} className="text-fluid-xs text-slate-500 hover:text-slate-800">
            닫기
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-[1fr_8rem] gap-2">
            <label>
              <span className={label}>제목 (검색에 쓰여요)</span>
              <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              <span className={label}>분류</span>
              <input className={field} value={category} onChange={(e) => setCategory(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className={label}>고객이 이렇게 말하면 (한 줄에 하나)</span>
            <textarea className={`${field} h-20`} value={triggers} onChange={(e) => setTriggers(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>대응 (한 줄에 「이름: 문장」)</span>
            <textarea className={`${field} h-36 leading-relaxed`} value={responses} onChange={(e) => setResponses(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>피할 말 (한 줄에 하나)</span>
            <textarea className={`${field} h-16`} value={avoid} onChange={(e) => setAvoid(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>지킬 기준</span>
            <input className={field} value={rule} onChange={(e) => setRule(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-fluid-xs text-slate-700">
            <input type="checkbox" checked={won} onChange={(e) => setWon(e.target.checked)} />
            예약 성사에 쓰인 대응 (검색에서 먼저 보여요)
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-fluid-xs font-semibold text-slate-600 hover:bg-slate-100">
            취소
          </button>
          <button
            type="button"
            disabled={busy || !title.trim()}
            onClick={() =>
              void onSave({
                title: title.trim(),
                category: category.trim(),
                triggers: lines(triggers),
                responses: parseResponses(responses),
                avoid: lines(avoid),
                rule: rule.trim(),
                wonInCall: won,
              })
            }
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-fluid-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
