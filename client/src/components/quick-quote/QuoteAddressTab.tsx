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
import { QuoteBottomBar, QuoteChip, quoteBottomButton, quoteCard } from './quoteChrome';

type Props = { onUsePyeong: (pyeong: string) => void };

function groupLine(group: QuickQuoteAreaGroup): string {
  const supply =
    group.supplyUnconfirmed || group.supplyPyeong == null ? '확인 필요' : `${formatArea1(group.supplyPyeong)}평`;
  return `전용 ${formatArea1(group.exclusiveSqm)}㎡ · 공급 ${supply} · ${group.households}세대`;
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
  const [showMinor, setShowMinor] = useState(false);
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
      setShowMinor(false);
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

  return (
    <div className="flex flex-col gap-2 px-3 pb-24 pt-2">
      <div className="flex gap-2">
        <input
          value={q}
          placeholder="도로명, 건물명"
          className="min-w-0 flex-1 rounded-xl border border-[#e6ebf2] bg-white px-3 py-2 text-fluid-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#1f4fb8]"
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
            <QuoteChip key={name} on={dong === name} label={name} onClick={() => chooseDong(name)} />
          ))}
        </div>
      ) : null}

      {units.length ? (
        <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
          {units.map((unit) => {
            const key = `${unit.floor}|${unit.ho}`;
            return (
              <QuoteChip
                key={key}
                on={unitKey === key}
                label={unit.floor ? `${unit.floor}층 ${unit.ho}` : unit.ho}
                onClick={() => {
                  setUnitKey(key);
                  loadAreas(unit.ho);
                }}
              />
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
        <div className={`${quoteCard} p-3 text-fluid-sm text-slate-800`}>{groupLine({ ...areas, households: 1 })}</div>
      ) : null}

      {areas?.kind === 'building' ? (
        <div className={`${quoteCard} p-3`}>
          <p className="text-fluid-sm text-slate-900">건물 전체 {formatArea1(areas.totalSqm)}㎡</p>
          <p className="mt-1 text-fluid-xs text-slate-600">{areas.note}</p>
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
