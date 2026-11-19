import { useState } from 'react';
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

type Props = { onUsePyeong: (pyeong: string) => void };

function groupLine(group: QuickQuoteAreaGroup): string {
  return `전용 ${formatArea1(group.exclusiveSqm)}㎡ · 공급 ${formatArea1(group.supplyPyeong)}평 · ${group.households}세대`;
}

export function QuoteAddressTab({ onUsePyeong }: Props) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<QuickQuoteAddressHit[]>([]);
  const [picked, setPicked] = useState<QuickQuoteAddressHit | null>(null);
  const [dongs, setDongs] = useState<string[]>([]);
  const [dong, setDong] = useState('');
  const [units, setUnits] = useState<QuickQuoteUnit[]>([]);
  const [unitKey, setUnitKey] = useState('');
  const [areas, setAreas] = useState<QuickQuoteAreasResult | null>(null);
  const [chosenSqm, setChosenSqm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : '주소를 찾지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const search = () => {
    const token = getToken();
    const keyword = q.trim();
    if (!token || keyword.length < 2) return;
    void run(async () => {
      const res = await searchQuickQuoteAddress(token, keyword);
      setItems(res.items);
      setPicked(null);
      setDongs([]);
      setDong('');
      setUnits([]);
      setUnitKey('');
      setAreas(null);
      setChosenSqm(null);
      if (!res.items.length) setError('주소를 찾지 못했어요.');
    });
  };

  const chooseAddress = (hit: QuickQuoteAddressHit) => {
    const token = getToken();
    if (!token) return;
    setPicked(hit);
    setDong('');
    setUnits([]);
    setUnitKey('');
    setAreas(null);
    setChosenSqm(null);
    void run(async () => {
      const res = await fetchQuickQuoteUnits(token, hit);
      setDongs(res.dongs);
    });
  };

  const chooseDong = (next: string) => {
    const token = getToken();
    if (!token || !picked) return;
    setDong(next);
    setUnitKey('');
    setAreas(null);
    setChosenSqm(null);
    void run(async () => {
      const res = await fetchQuickQuoteUnits(token, picked, next);
      setUnits(res.units);
    });
  };

  const loadAreas = (nextHo?: string) => {
    const token = getToken();
    if (!token || !picked) return;
    const hoName = nextHo ?? '';
    setChosenSqm(null);
    void run(async () => {
      const res = await fetchQuickQuoteAreas(token, picked, dong || undefined, hoName || undefined);
      setAreas(res);
      if (res.kind === 'unit') setChosenSqm(res.exclusiveSqm);
      if (res.kind === 'empty') setError('이 주소의 면적을 찾지 못했어요.');
    });
  };

  const supplyPyeong =
    areas?.kind === 'unit'
      ? areas.supplyPyeong
      : areas?.kind === 'groups'
        ? (areas.groups.find((group) => group.exclusiveSqm === chosenSqm)?.supplyPyeong ?? null)
        : null;

  return (
    <div className="flex flex-col gap-2 px-3 pb-24 pt-2">
      <div className="flex gap-2">
        <input
          value={q}
          placeholder="도로명, 건물명"
          className="min-w-0 flex-1 rounded-xl bg-field px-3 py-2 text-fluid-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-300"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search();
          }}
          onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
        />
        <Button variant="secondary" disabled={busy || q.trim().length < 2} onClick={search}>
          찾기
        </Button>
      </div>

      {items.map((hit) => (
        <Button
          key={`${hit.admCd}-${hit.rnMgtSn}-${hit.buldMnnm}-${hit.buldSlno}`}
          variant="quiet"
          nowrap={false}
          className={`!h-auto w-full justify-start rounded-2xl bg-white px-3 py-2 text-left shadow-card ${
            picked === hit ? 'ring-2 ring-slate-900' : ''
          }`}
          onClick={() => chooseAddress(hit)}
        >
          <span className="block text-fluid-sm text-slate-900">{hit.road}</span>
          <span className="mt-0.5 block text-fluid-2xs text-slate-500">
            {[hit.jibun, hit.building].filter(Boolean).join(' · ')}
          </span>
        </Button>
      ))}

      {dongs.length ? (
        <div className="flex flex-wrap gap-1">
          {dongs.map((name) => (
            <Button
              key={name}
              variant="quiet"
              size="sm"
              className={dong === name ? '!bg-white shadow-thumb' : ''}
              onClick={() => chooseDong(name)}
            >
              {name}
            </Button>
          ))}
        </div>
      ) : null}

      {units.length ? (
        <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
          {units.map((unit) => {
            const key = `${unit.floor}|${unit.ho}`;
            return (
              <Button
                key={key}
                variant="quiet"
                size="sm"
                className={unitKey === key ? '!bg-white shadow-thumb' : ''}
                onClick={() => {
                  setUnitKey(key);
                  loadAreas(unit.ho);
                }}
              >
                {unit.floor ? `${unit.floor}층 ${unit.ho}` : unit.ho}
              </Button>
            );
          })}
        </div>
      ) : null}

      {picked ? (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setUnitKey('');
            loadAreas();
          }}
        >
          {dong ? '이 동의 평형 보기' : '이 단지의 평형 보기'}
        </Button>
      ) : null}

      {busy ? <p className="text-fluid-xs text-slate-500">찾는 중</p> : null}
      {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}

      {areas?.kind === 'groups'
        ? areas.groups.map((group) => (
            <Button
              key={`${group.exclusiveSqm}-${group.households}`}
              variant="quiet"
              nowrap={false}
              className={`!h-auto w-full justify-start rounded-2xl bg-white px-3 py-2 text-left shadow-card ${
                chosenSqm === group.exclusiveSqm ? 'ring-2 ring-slate-900' : ''
              }`}
              onClick={() => setChosenSqm(group.exclusiveSqm)}
            >
              {groupLine(group)}
            </Button>
          ))
        : null}

      {areas?.kind === 'unit' ? (
        <div className="rounded-2xl bg-white p-3 shadow-card text-fluid-sm text-slate-800">
          <p>전용 {formatArea1(areas.exclusiveSqm)}㎡</p>
          <p className="mt-1">
            공급 {formatArea1(areas.supplySqm)}㎡ · {formatArea1(areas.supplyPyeong)}평
          </p>
        </div>
      ) : null}

      {areas?.kind === 'building' ? (
        <div className="rounded-2xl bg-white p-3 shadow-card">
          <p className="text-fluid-sm text-slate-900">건물 전체 {formatArea1(areas.totalSqm)}㎡</p>
          <p className="mt-1 text-fluid-xs text-slate-600">{areas.note}</p>
        </div>
      ) : null}

      <p className="px-1 text-fluid-2xs text-slate-500">국토교통부 공개자료</p>

      <div
        className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] px-3 pt-2"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <Button
          variant="primary"
          size="lg"
          className="w-full shadow-bar"
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
      </div>
    </div>
  );
}
