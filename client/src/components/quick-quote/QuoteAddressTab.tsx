import { useRef, useState } from 'react';
import { formatArea1 } from '@shared/quickQuoteArea';
import {
  fetchQuickQuoteAreas,
  fetchQuickQuoteUnits,
  searchQuickQuoteAddress,
  type QuickQuoteAddressHit,
  type QuickQuoteAreaGroup,
  type QuickQuoteAreasResult,
  type QuickQuoteUnit,
} from '../../api/quickQuote';
import { getToken } from '../../stores/auth';
import { Button } from '../ui/Button';
import { QuoteBottomBar, QuoteChip, quoteBottomButton, quoteCard } from './quoteChrome';

type Props = { onUsePyeong: (pyeong: string) => void; onOpenArea: () => void };

const RECENT_KEY = 'cbiseo.quoteAddress.recent';
const PAGE_WINDOW = 10;
const EMPTY_AREA_NOTE = '이 단지는 공개자료에 집별 면적이 아직 없어요(신축이면 등록 전일 수 있어요)';
const UNIT_MISS_NOTE = '이 호수는 공개자료에서 못 찾았어요. 단지 평형에서 골라 주세요';

function groupLine(group: QuickQuoteAreaGroup): string {
  const supply =
    group.supplyUnconfirmed || group.supplyPyeong == null ? '확인 필요' : `${formatArea1(group.supplyPyeong)}평`;
  return `전용 ${formatArea1(group.exclusiveSqm)}㎡ · 공급 ${supply} · ${group.households}세대`;
}

function hitKey(hit: QuickQuoteAddressHit): string {
  return `${hit.admCd}-${hit.rnMgtSn}-${hit.buldMnnm}-${hit.buldSlno}-${hit.lnbrMnnm}-${hit.lnbrSlno}`;
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length >= 2).slice(0, 5);
  } catch {
    return [];
  }
}

function remember(keyword: string, prev: string[]): string[] {
  const next = [keyword, ...prev.filter((item) => item !== keyword)].slice(0, 5);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* 이 기기에 남기지 못해도 검색은 그대로 진행한다. */
  }
  return next;
}

export function QuoteAddressTab({ onUsePyeong, onOpenArea }: Props) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<QuickQuoteAddressHit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [shown, setShown] = useState(PAGE_WINDOW);
  const [notice, setNotice] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [picked, setPicked] = useState<QuickQuoteAddressHit | null>(null);
  const [dongs, setDongs] = useState<string[]>([]);
  const [, setDong] = useState('');
  const [dongInput, setDongInput] = useState('');
  const [hoInput, setHoInput] = useState('');
  const [, setUnits] = useState<QuickQuoteUnit[]>([]);
  const [, setUnitKey] = useState('');
  const [areas, setAreas] = useState<QuickQuoteAreasResult | null>(null);
  const [chosenSqm, setChosenSqm] = useState<number | null>(null);
  const [showMinor, setShowMinor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const searchSeq = useRef(0);

  const run = async (work: () => Promise<void>, label = '찾는 중이에요') => {
    setBusy(true);
    setBusyLabel(label);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : '주소를 찾지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const clearPick = () => {
    setPicked(null);
    setDongs([]);
    setDong('');
    setUnits([]);
    setUnitKey('');
    setAreas(null);
    setChosenSqm(null);
    setShowMinor(false);
  };

  const search = (keyword = q.trim()) => {
    const token = getToken();
    const text = keyword.trim();
    if (!token || text.length < 2) return;
    setQ(text);
    const seq = ++searchSeq.current;
    void run(async () => {
      const res = await searchQuickQuoteAddress(token, text, 1);
      if (seq !== searchSeq.current) return;
      setRecent((prev) => remember(text, prev));
      setItems(res.items);
      setTotal(res.total);
      setPage(res.page || 1);
      setShown(PAGE_WINDOW);
      setNotice(res.items.length ? null : res.notice);
      clearPick();
    });
  };

  const loadMore = () => {
    if (shown < items.length) {
      setShown((count) => Math.min(items.length, count + PAGE_WINDOW));
      return;
    }
    const token = getToken();
    const text = q.trim();
    if (!token || !text || items.length >= total) return;
    const seq = searchSeq.current;
    void run(async () => {
      const res = await searchQuickQuoteAddress(token, text, page + 1);
      if (seq !== searchSeq.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map(hitKey));
        const next = [...prev];
        for (const hit of res.items) {
          const key = hitKey(hit);
          if (seen.has(key)) continue;
          seen.add(key);
          next.push(hit);
        }
        return next;
      });
      setTotal(res.total);
      setPage(res.page || page + 1);
      setShown((count) => count + PAGE_WINDOW);
    });
  };

  const chooseAddress = (hit: QuickQuoteAddressHit) => {
    const token = getToken();
    if (!token) return;
    setPicked(hit);
    setDong('');
    setDongInput('');
    setHoInput('');
    setUnits([]);
    setUnitKey('');
    setAreas(null);
    setChosenSqm(null);
    void run(async () => {
      const res = await fetchQuickQuoteUnits(token, hit);
      setDongs(res.dongs);
    });
  };

  const loadAreas = (nextHo?: string, nextDong?: string) => {
    const token = getToken();
    if (!token || !picked) return;
    const hoName = nextHo ?? '';
    const dongName = nextDong ?? '';
    setDong(dongName);
    setChosenSqm(null);
    void run(async () => {
      const res = await fetchQuickQuoteAreas(token, picked, dongName || undefined, hoName || undefined, q.trim());
      setAreas(res);
      if (res.kind === 'unit') setChosenSqm(res.exclusiveSqm);
    }, '평수를 찾는 중이에요');
  };

  const pickedGroup =
    areas?.kind === 'groups' ? areas.groups.find((group) => group.exclusiveSqm === chosenSqm) : undefined;
  const supplyPyeong =
    areas?.kind === 'unit'
      ? areas.supplyUnconfirmed
        ? null
        : areas.supplyPyeong
      : pickedGroup && !pickedGroup.supplyUnconfirmed
        ? pickedGroup.supplyPyeong
        : null;
  const mainGroups = areas?.kind === 'groups' ? areas.groups.filter((group) => group.households >= 3) : [];
  const minorGroups = areas?.kind === 'groups' ? areas.groups.filter((group) => group.households < 3) : [];
  const visible = items.slice(0, shown);

  return (
    <div className="flex flex-col gap-2 px-3 pb-40 pt-2">
      <div className="flex gap-2">
        <input
          value={q}
          placeholder="단지 이름 + 동네 (예: 부평 래미안, 송도 센트럴파크)"
          className="min-w-0 flex-1 rounded-xl border border-[#e6ebf2] bg-white px-3 py-2 text-fluid-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#1f4fb8]"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search();
          }}
          onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
        />
        <Button variant="secondary" disabled={busy || q.trim().length < 2} onClick={() => search()}>
          찾기
        </Button>
      </div>

      {recent.length ? (
        <div className="flex flex-wrap gap-1">
          {recent.map((name) => (
            <QuoteChip key={name} on={false} label={name} onClick={() => search(name)} />
          ))}
        </div>
      ) : null}

      {total > 0 ? (
        <p className="px-1 text-fluid-xs text-slate-600">
          검색 결과 {total}건 — 동네 이름을 같이 넣으면 좁혀져요
        </p>
      ) : null}
      {notice ? <p className="px-1 text-fluid-xs text-slate-600">{notice}</p> : null}

      {visible.map((hit) => (
        <Button
          key={hitKey(hit)}
          variant="quiet"
          nowrap={false}
          className={`!h-auto w-full justify-start rounded-2xl bg-white px-3 py-2 text-left shadow-card ${
            picked === hit ? 'ring-2 ring-slate-900' : ''
          }`}
          onClick={() => chooseAddress(hit)}
        >
          <span className="block text-fluid-sm font-semibold text-slate-900">{hit.building || hit.road}</span>
          <span className="mt-0.5 block text-fluid-2xs text-slate-500">
            {hit.building ? [hit.road, hit.jibun].filter(Boolean).join(' · ') : hit.jibun}
          </span>
        </Button>
      ))}

      {shown < total ? (
        <Button variant="quiet" size="sm" className="self-start" disabled={busy} onClick={loadMore}>
          더 보기
        </Button>
      ) : null}

      {picked ? (
        <div className={`${quoteCard} p-3`}>
          <p className="text-fluid-2xs font-semibold text-slate-700">동·호수로 찾기</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <label className="flex min-w-0 flex-1 items-center rounded-xl border border-[#e6ebf2] bg-white px-2.5 focus-within:border-[#1f4fb8]">
              <input
                value={dongInput}
                inputMode="text"
                placeholder="107"
                aria-label="동"
                className="min-w-0 flex-1 bg-transparent py-2 text-fluid-sm tabular-nums text-slate-900 outline-none placeholder:text-slate-300"
                onChange={(e) => setDongInput(e.target.value.slice(0, 12))}
              />
              <span className="text-fluid-xs text-slate-500">동</span>
            </label>
            <label className="flex min-w-0 flex-1 items-center rounded-xl border border-[#e6ebf2] bg-white px-2.5 focus-within:border-[#1f4fb8]">
              <input
                value={hoInput}
                inputMode="numeric"
                placeholder="3101"
                aria-label="호"
                className="min-w-0 flex-1 bg-transparent py-2 text-fluid-sm tabular-nums text-slate-900 outline-none placeholder:text-slate-300"
                onChange={(e) => setHoInput(e.target.value.replace(/[^0-9A-Za-z-]/g, '').slice(0, 8))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && dongInput.trim()) {
                    setUnitKey('');
                    loadAreas(hoInput.trim(), dongInput.trim());
                  }
                }}
              />
              <span className="text-fluid-xs text-slate-500">호</span>
            </label>
            <Button
              variant="primary"
              size="sm"
              disabled={busy || !dongInput.trim()}
              onClick={() => {
                setUnitKey('');
                loadAreas(hoInput.trim(), dongInput.trim());
              }}
            >
              찾기
            </Button>
          </div>
          <p className="mt-1.5 text-fluid-2xs text-slate-500">
            {dongs.length
              ? `이 단지 동: ${dongs.length > 6 ? `${dongs.slice(0, 3).join(', ')} … ${dongs[dongs.length - 1]} (${dongs.length}개)` : dongs.join(', ')}`
              : '호수를 비우면 그 동의 평형이 나와요.'}
          </p>
          <Button
            variant="quiet"
            size="sm"
            className="mt-1 px-0"
            disabled={busy}
            onClick={() => {
              setUnitKey('');
              loadAreas();
            }}
          >
            단지 전체 평형 보기
          </Button>
        </div>
      ) : null}

      {busy ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/35 p-6"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-[260px] rounded-2xl bg-white px-5 py-4 text-center shadow-xl">
            <span
              className="mx-auto block h-7 w-7 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#1f4fb8]"
              aria-hidden
            />
            <p className="mt-3 text-fluid-sm font-semibold text-slate-900">{busyLabel || '찾는 중이에요'}</p>
            {busyLabel === '평수를 찾는 중이에요' ? (
              <p className="mt-1 text-fluid-2xs leading-relaxed text-slate-500">
                처음 보는 단지는 30초쯤 걸려요.
                <br />
                한 번 찾은 단지는 다음부터 바로 나와요.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}

      {areas?.kind === 'groups' && areas.note ? (
        <p className="px-1 text-fluid-xs text-slate-600">{areas.note}</p>
      ) : null}

      {mainGroups.map((group) => (
        <Button
          key={`main-${group.exclusiveSqm}-${group.households}`}
          variant="quiet"
          nowrap={false}
          className={`!h-auto w-full justify-start px-3 py-2 text-left ${quoteCard} ${
            chosenSqm === group.exclusiveSqm ? '!border-[#1f4fb8]' : ''
          }`}
          onClick={() => setChosenSqm(group.exclusiveSqm)}
        >
          {groupLine(group)}
        </Button>
      ))}

      {minorGroups.length ? (
        <Button variant="quiet" size="sm" className="self-start" onClick={() => setShowMinor((prev) => !prev)}>
          {showMinor ? '기타 평형 접기' : `기타 평형 ${minorGroups.length}개 더보기`}
        </Button>
      ) : null}

      {showMinor
        ? minorGroups.map((group) => (
            <Button
              key={`minor-${group.exclusiveSqm}-${group.households}`}
              variant="quiet"
              nowrap={false}
              className={`!h-auto w-full justify-start px-3 py-2 text-left ${quoteCard} ${
                chosenSqm === group.exclusiveSqm ? '!border-[#1f4fb8]' : ''
              }`}
              onClick={() => setChosenSqm(group.exclusiveSqm)}
            >
              {groupLine(group)}
            </Button>
          ))
        : null}

      {areas?.kind === 'unit' ? (
        <div className={`${quoteCard} p-3 text-fluid-sm text-slate-800`}>
          {areas.line || groupLine({ ...areas, households: 1 })}
        </div>
      ) : null}

      {picked && areas && areas.kind !== 'empty' && (picked.building || '').trim() ? (
        <a
          href={`https://search.naver.com/search.naver?query=${encodeURIComponent(`${(picked.building || '').trim()} 평면도`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start px-1 text-fluid-xs font-medium text-[#1f4fb8] underline underline-offset-2"
        >
          평면도 보기 (네이버) ↗
        </a>
      ) : null}

      {areas?.kind === 'building' ? (
        <div className={`${quoteCard} p-3`}>
          <p className="text-fluid-sm text-slate-900">건물 전체 {formatArea1(areas.totalSqm)}㎡</p>
          <p className="mt-1 text-fluid-xs text-slate-600">{areas.note}</p>
          <Button variant="quiet" size="sm" className="mt-2 self-start px-0" onClick={clearPick}>
            다른 결과를 골라 보세요
          </Button>
        </div>
      ) : null}

      {areas?.kind === 'empty' ? (
        <div className={`${quoteCard} p-3`}>
          <p className="text-fluid-xs text-slate-700">{areas.note || EMPTY_AREA_NOTE}</p>
          {areas.note === UNIT_MISS_NOTE ? null : (
            <Button variant="secondary" size="sm" className="mt-2" onClick={onOpenArea}>
              면적 계산으로 가기
            </Button>
          )}
        </div>
      ) : null}

      <p className="px-1 text-fluid-2xs text-slate-500">국토교통부 공개자료</p>

      <QuoteBottomBar>
        <Button
          variant="primary"
          size="lg"
          className={quoteBottomButton}
          disabled={supplyPyeong == null}
          onClick={() => {
            if (supplyPyeong == null) return;
            onUsePyeong(formatArea1(supplyPyeong));
          }}
        >
          {supplyPyeong != null
            ? `${formatArea1(supplyPyeong)}평으로 견적 문구 만들기 →`
            : '평수를 고른 뒤 문구를 만들 수 있어요'}
        </Button>
      </QuoteBottomBar>
    </div>
  );
}
