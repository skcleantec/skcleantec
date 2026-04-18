import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ScheduleItem } from '../../api/schedule';
import type { GeocodeBatchMeta, GeocodeBatchResultRow } from '../../api/geocode';
import { geocodeAddressBatch } from '../../api/geocode';
import { getScheduleTimeBucket, isSideCleaningTime } from '../../utils/scheduleTimeBucket';
import { ModalCloseButton } from './ModalCloseButton';

const MAX_GEOCODE = 35;
/** 서버 배치 한도(35) 이하로 잘게 나눠 진행률 표시 */
const GEOCODE_CHUNK = 8;

function fullAddressLine(item: ScheduleItem): string {
  const a = item.address?.trim() ?? '';
  const d = item.addressDetail?.trim() ?? '';
  return d ? `${a} ${d}` : a;
}

/** 접수 시 카카오 주소로 넣는 도로명·번지(`address`)만 지오코딩·지도 검색에 사용. `addressDetail`(동·호 등)을 붙이면 오히려 못 찾는 경우가 많음. */
function geocodeQueryLine(item: ScheduleItem): string {
  const road = item.address?.trim() ?? '';
  if (road) return road;
  return fullAddressLine(item);
}

function kakaoMapSearchUrl(addressLine: string): string {
  return `https://map.kakao.com/link/search/${encodeURIComponent(addressLine)}`;
}

function googleMapSearchUrl(addressLine: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** 마커 위 짧은 라벨용 (전체는 title로) */
function truncateMapLabel(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function stripParenNoiseForGeocode(s: string): string {
  return s.replace(/\([^)]{0,80}\)/g, ' ').replace(/\s+/g, ' ').trim();
}

function primaryLeaderName(item: ScheduleItem): string | null {
  const n = item.assignments?.[0]?.teamLeader?.name?.trim();
  return n && n.length > 0 ? n : null;
}

function primaryLeaderId(item: ScheduleItem): string | null {
  const id = item.assignments?.[0]?.teamLeader?.id;
  return id && id.length > 0 ? id : null;
}

/** 오전·오후·사이(미확정 포함) — 목록·서버 `getScheduleTimeBucket` 과 동일 규칙으로 마커 색 구분 */
function scheduleSlotKindForMap(item: ScheduleItem): 'morning' | 'afternoon' | 'between' | 'other' {
  const bucket = getScheduleTimeBucket(item);
  if (bucket === 'morning') return 'morning';
  if (bucket === 'afternoon') return 'afternoon';
  if (isSideCleaningTime(item.preferredTime)) return 'between';
  return 'other';
}

function slotMarkerStyle(kind: 'morning' | 'afternoon' | 'between' | 'other'): {
  color: string;
  fillColor: string;
} {
  switch (kind) {
    case 'morning':
      return { color: '#1e40af', fillColor: '#2563eb' };
    case 'afternoon':
      return { color: '#047857', fillColor: '#10b981' };
    case 'between':
      return { color: '#b45309', fillColor: '#f59e0b' };
    default:
      return { color: '#4b5563', fillColor: '#9ca3af' };
  }
}

/** 지도 circleMarker와 동일 스타일의 범례용 작은 원 */
function ScheduleMapLegendCircle({ kind }: { kind: 'morning' | 'afternoon' | 'between' | 'other' }) {
  const { color, fillColor } = slotMarkerStyle(kind);
  return (
    <span
      className="box-border inline-block h-3 w-3 shrink-0 rounded-full border-2 align-middle"
      style={{ borderColor: color, backgroundColor: fillColor }}
      aria-hidden
    />
  );
}

/** 팀장별 라벨 박스 배경(동일 id → 동일 색) */
function leaderLabelStyle(leaderId: string | null): { bg: string; border: string } {
  if (!leaderId) {
    return { bg: '#f3f4f6', border: '#d1d5db' };
  }
  let h = 0;
  for (let i = 0; i < leaderId.length; i++) {
    h = (h + leaderId.charCodeAt(i) * (i + 17)) % 360;
  }
  return { bg: `hsl(${h} 72% 92%)`, border: `hsl(${h} 50% 72%)` };
}

/** 1차(도로명) 실패 시 전체주소·괄호 제거 등으로 추가 배치. 청크마다 onProgress로 % 갱신 */
async function geocodeRowsWithRetryPasses(
  token: string,
  list: Array<{ item: ScheduleItem; query: string }>,
  onProgress: (pct: number, label: string) => void
): Promise<{ results: GeocodeBatchResultRow[]; meta?: GeocodeBatchMeta }> {
  const primaryQueries = list.map((r) => r.query);
  const n = primaryQueries.length;
  const r0: GeocodeBatchResultRow[] = [];
  let meta: GeocodeBatchMeta | undefined;

  onProgress(1, '요청 준비…');
  for (let i = 0; i < n; i += GEOCODE_CHUNK) {
    const slice = primaryQueries.slice(i, i + GEOCODE_CHUNK);
    const { results, meta: m } = await geocodeAddressBatch(token, slice);
    meta ??= m;
    r0.push(...results);
    const done = r0.length;
    const pct = Math.min(70, Math.round(2 + (done / Math.max(1, n)) * 68));
    onProgress(pct, `좌표 조회 ${done}/${n}건`);
  }

  const work: GeocodeBatchResultRow[] = r0.map((row, i) => ({
    ...row,
    query: list[i]!.query,
  }));
  const attempted = new Set<string>(primaryQueries);

  onProgress(71, '1차 조회 완료');

  const maxRetryRounds = meta?.kakaoApiConfigured ? 1 : 2;
  const roundSpan = 26 / Math.max(1, maxRetryRounds);

  for (let round = 0; round < maxRetryRounds; round++) {
    const altToIndices = new Map<string, number[]>();
    for (let i = 0; i < list.length; i++) {
      if (work[i]?.lat != null && work[i]?.lon != null) continue;
      const { item, query } = list[i]!;
      const cand = new Set<string>();
      const full = fullAddressLine(item);
      if (full && full !== query) cand.add(full);
      const sq = stripParenNoiseForGeocode(query);
      if (sq && sq !== query) cand.add(sq);
      if (full && full !== query) {
        const fs = stripParenNoiseForGeocode(full);
        if (fs && fs !== query && fs !== full) cand.add(fs);
      }
      for (const c of cand) {
        const t = c.trim();
        if (!t || attempted.has(t)) continue;
        if (!altToIndices.has(t)) altToIndices.set(t, []);
        altToIndices.get(t)!.push(i);
      }
    }
    const keys = [...altToIndices.keys()];
    if (keys.length === 0) break;
    for (const t of keys) attempted.add(t);
    let doneAlt = 0;
    for (let off = 0; off < keys.length; off += GEOCODE_CHUNK) {
      const chunk = keys.slice(off, off + GEOCODE_CHUNK);
      const { results: r2 } = await geocodeAddressBatch(token, chunk);
      chunk.forEach((q, j) => {
        const hit = r2[j];
        if (hit?.lat == null || hit?.lon == null) return;
        for (const idx of altToIndices.get(q) ?? []) {
          if (work[idx]?.lat != null && work[idx]?.lon != null) continue;
          work[idx] = {
            query: list[idx]!.query,
            lat: hit.lat,
            lon: hit.lon,
            displayName: hit.displayName,
          };
        }
      });
      doneAlt += chunk.length;
      const frac = doneAlt / keys.length;
      const pct = Math.min(
        98,
        Math.round(72 + round * roundSpan + frac * roundSpan * 0.95)
      );
      onProgress(pct, `주소 재검색 ${Math.min(doneAlt, keys.length)}/${keys.length}건 (${round + 1}/${maxRetryRounds}차)`);
    }
  }

  onProgress(100, '지도에 반영합니다…');
  return { results: work, meta };
}

type Placed = {
  id: string;
  customerName: string;
  inquiryNumber?: string | null;
  teamLeaderName: string | null;
  teamLeaderId: string | null;
  slotKind: 'morning' | 'afternoon' | 'between' | 'other';
  /** 목록·팝업에 보이는 전체 주소(상세 포함) */
  addressLine: string;
  /** 카카오·구글맵 링크용 — 지오코딩에 쓴 문자열과 동일(도로명·번지 위주) */
  mapSearchLine: string;
  lat: number;
  lng: number;
};

function jitterDuplicateCoords(points: Placed[]): Placed[] {
  const buckets = new Map<string, Placed[]>();
  for (const p of points) {
    const k = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    const arr = buckets.get(k) ?? [];
    arr.push(p);
    buckets.set(k, arr);
  }
  const out: Placed[] = [];
  for (const arr of buckets.values()) {
    if (arr.length === 1) {
      out.push(arr[0]!);
      continue;
    }
    arr.forEach((p, i) => {
      const step = 0.00012;
      const angle = (2 * Math.PI * i) / arr.length;
      out.push({
        ...p,
        lat: p.lat + Math.sin(angle) * step * (i + 1),
        lng: p.lng + Math.cos(angle) * step * (i + 1),
      });
    });
  }
  return out;
}

export function ScheduleDayMapModal({
  open,
  onClose,
  dateLabel,
  items,
  token,
}: {
  open: boolean;
  onClose: () => void;
  dateLabel: string;
  items: ScheduleItem[];
  token: string;
}) {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (open) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  }, [open]);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadPct, setLoadPct] = useState(0);
  const [loadDetail, setLoadDetail] = useState('');
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [skippedNoAddress, setSkippedNoAddress] = useState(0);
  const [skippedCap, setSkippedCap] = useState(0);
  const [geocodeMissCount, setGeocodeMissCount] = useState(0);
  const [kakaoApiConfigured, setKakaoApiConfigured] = useState(false);

  const rows = useMemo(() => {
    const list: Array<{ item: ScheduleItem; query: string }> = [];
    let noAddr = 0;
    for (const item of items) {
      const query = geocodeQueryLine(item);
      if (!query) {
        noAddr++;
        continue;
      }
      list.push({ item, query });
    }
    let cap = 0;
    const limited = list.slice(0, MAX_GEOCODE);
    if (list.length > MAX_GEOCODE) cap = list.length - MAX_GEOCODE;
    return { list: limited, skippedNoAddress: noAddr, skippedCap: cap };
  }, [items]);

  const loadGeocode = useCallback(async () => {
    if (!open || rows.list.length === 0) {
      setPlaced([]);
      setGeocodeMissCount(0);
      setKakaoApiConfigured(false);
      setLoadPct(0);
      setLoadDetail('');
      setPhase(rows.list.length === 0 ? 'ready' : 'idle');
      return;
    }
    setPhase('loading');
    setErrorMsg(null);
    setLoadPct(0);
    setLoadDetail('시작합니다…');
    setSkippedNoAddress(rows.skippedNoAddress);
    setSkippedCap(rows.skippedCap);
    try {
      const { results, meta } = await geocodeRowsWithRetryPasses(token, rows.list, (pct, label) => {
        setLoadPct(pct);
        setLoadDetail(label);
      });
      setKakaoApiConfigured(meta?.kakaoApiConfigured ?? false);
      const next: Placed[] = [];
      for (let i = 0; i < rows.list.length; i++) {
        const { item, query } = rows.list[i]!;
        const r = results[i];
        const lat = r?.lat ?? null;
        const lon = r?.lon ?? null;
        if (lat != null && lon != null) {
          next.push({
            id: item.id,
            customerName: item.customerName,
            inquiryNumber: item.inquiryNumber,
            teamLeaderName: primaryLeaderName(item),
            teamLeaderId: primaryLeaderId(item),
            slotKind: scheduleSlotKindForMap(item),
            addressLine: fullAddressLine(item),
            mapSearchLine: query,
            lat,
            lng: lon,
          });
        }
      }
      setPlaced(jitterDuplicateCoords(next));
      setGeocodeMissCount(rows.list.length - next.length);
      setPhase('ready');
      setLoadPct(0);
      setLoadDetail('');
    } catch (e) {
      setPhase('error');
      setErrorMsg(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
      setLoadPct(0);
      setLoadDetail('');
    }
  }, [open, rows.list, rows.skippedCap, rows.skippedNoAddress, token]);

  useEffect(() => {
    if (!open) {
      setPhase('idle');
      setPlaced([]);
      setGeocodeMissCount(0);
      setKakaoApiConfigured(false);
      setErrorMsg(null);
      setLoadPct(0);
      setLoadDetail('');
      return;
    }
    void loadGeocode();
  }, [open, loadGeocode]);

  useEffect(() => {
    if (!open || phase !== 'ready') return;
    const el = mapHostRef.current;
    if (!el) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const group = L.layerGroup().addTo(map);

    for (const p of placed) {
      const leaderLine = p.teamLeaderName ?? '미배정';
      const slotStroke = slotMarkerStyle(p.slotKind);
      const lb = leaderLabelStyle(p.teamLeaderId);
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 8,
        color: slotStroke.color,
        weight: 2,
        fillColor: slotStroke.fillColor,
        fillOpacity: 0.95,
      });
      m.bindPopup(
        `<div class="text-fluid-xs" style="min-width:12rem;max-width:18rem">
          <div style="font-weight:700;margin-bottom:2px">${escHtml(p.customerName)}</div>
          <div style="font-weight:600;color:#374151;margin-bottom:6px;font-size:12px">${escHtml(leaderLine)}</div>
          ${p.inquiryNumber ? `<div style="font-size:11px;color:#6b7280;margin-bottom:4px">접수 ${escHtml(String(p.inquiryNumber))}</div>` : ''}
          <div style="color:#444;line-height:1.35;margin-bottom:8px">${escHtml(p.addressLine)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px 12px">
            <a href="${kakaoMapSearchUrl(p.mapSearchLine)}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;text-decoration:underline">카카오맵</a>
            <a href="${googleMapSearchUrl(p.mapSearchLine)}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;text-decoration:underline">구글맵</a>
          </div>
        </div>`
      );
      const shortCust = truncateMapLabel(p.customerName, 11);
      const shortLeader = truncateMapLabel(leaderLine, 10);
      m.bindTooltip(
        `<div class="schedule-map-marker-label-box" style="background:${lb.bg};border:1px solid ${lb.border}">
          <div title="${escAttr(p.customerName)}">${escHtml(shortCust)}</div>
          <div class="schedule-map-marker-label-line2" title="${escAttr(leaderLine)}">${escHtml(shortLeader)}</div>
        </div>`,
        {
          permanent: true,
          direction: 'top',
          offset: [0, -8],
          className: 'schedule-map-marker-name',
          opacity: 1,
          interactive: false,
        }
      );
      m.addTo(group);
    }

    if (placed.length === 0) {
      map.setView([37.5665, 126.978], 11);
    } else if (placed.length === 1) {
      map.setView([placed[0]!.lat, placed[0]!.lng], 15);
    } else {
      const b = L.latLngBounds(placed.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(b, { padding: [36, 36], maxZoom: 16 });
    }

    const fixSize = () => {
      map.invalidateSize();
      if (placed.length > 1) {
        const b = L.latLngBounds(placed.map((p) => [p.lat, p.lng] as [number, number]));
        map.fitBounds(b, { padding: [36, 36], maxZoom: 16 });
      }
    };
    queueMicrotask(fixSize);
    const t1 = window.setTimeout(fixSize, 120);
    const t2 = window.setTimeout(fixSize, 400);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [open, phase, placed]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-day-map-title"
      onClick={onClose}
    >
      <style>{`
        .leaflet-tooltip.schedule-map-marker-name {
          margin-top: -4px;
          padding: 0 !important;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          pointer-events: none !important;
        }
        .leaflet-tooltip.schedule-map-marker-name .schedule-map-marker-label-box {
          font-size: 11px;
          line-height: 1.3;
          font-weight: 600;
          color: #111827;
          border-radius: 6px;
          padding: 4px 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
          max-width: 9rem;
        }
        .leaflet-tooltip.schedule-map-marker-name .schedule-map-marker-label-line2 {
          font-size: 10px;
          font-weight: 600;
          margin-top: 2px;
          opacity: 0.92;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
      <div
        className="relative flex max-h-[min(100dvh,720px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-xl border border-gray-200 bg-white shadow-xl sm:max-h-[90vh] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-4 pr-14 sm:px-5 sm:pb-4 sm:pt-5">
          <h2 id="schedule-day-map-title" className="text-lg font-semibold text-gray-900 sm:text-xl">
            접수건 위치 ({dateLabel})
          </h2>
          {(skippedNoAddress > 0 || skippedCap > 0 || geocodeMissCount > 0 || phase === 'ready') && (
            <div className="mt-2 space-y-1.5">
              {(skippedNoAddress > 0 || skippedCap > 0 || geocodeMissCount > 0) && (
                <p className="text-fluid-xs text-amber-800">
                  {skippedNoAddress > 0 ? `주소 없음 ${skippedNoAddress}건은 표에서만 보입니다. ` : ''}
                  {skippedCap > 0 ? `지도 변환은 최대 ${MAX_GEOCODE}건까지 처리했습니다. (${skippedCap}건 생략)` : ''}
                  {geocodeMissCount > 0
                    ? `좌표를 찾지 못한 접수 ${geocodeMissCount}건은 지도에 마커가 없습니다.${
                        !kakaoApiConfigured
                          ? ' (server/.env 또는 루트 .env에 KAKAO_REST_API_KEY를 넣고 서버를 재시작하면 이 지도에도 마커가 더 잘 붙습니다.)'
                          : ''
                      }`
                    : ''}
                </p>
              )}
              {phase === 'ready' && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-fluid-2xs text-gray-600">
                  <span className="font-medium text-gray-500">마커</span>
                  <span className="inline-flex items-center gap-1">
                    <ScheduleMapLegendCircle kind="morning" />
                    오전
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ScheduleMapLegendCircle kind="afternoon" />
                    오후
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ScheduleMapLegendCircle kind="between" />
                    사이청소(미정)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ScheduleMapLegendCircle kind="other" />
                    그 외
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row md:min-h-[420px]">
          <div
            ref={mapHostRef}
            className="h-[min(440px,52dvh)] min-h-[280px] w-full shrink-0 border-b border-gray-100 md:h-[min(480px,58vh)] md:min-h-[400px] md:flex-1 md:border-b-0 md:border-r"
          />

          <div className="max-h-[40vh] w-full shrink-0 overflow-y-auto overscroll-y-contain md:max-h-none md:w-72 md:shrink-0">
            <ul className="divide-y divide-gray-100 text-fluid-sm">
              {items.map((item) => {
                const line = fullAddressLine(item);
                const mapLine = geocodeQueryLine(item);
                const hit = placed.find((p) => p.id === item.id);
                const leaderDisp = primaryLeaderName(item) ?? '미배정';
                const coordMiss = phase === 'ready' && Boolean(mapLine) && !hit;
                return (
                  <li
                    key={item.id}
                    className={`px-3 py-2.5 sm:px-4 ${coordMiss ? 'rounded-md border-2 border-red-400 bg-red-50/70' : ''}`}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span className="font-medium text-gray-900">{item.customerName}</span>
                      <span className="text-fluid-xs font-medium text-gray-600">· {leaderDisp}</span>
                    </div>
                    {item.inquiryNumber && (
                      <div className="text-fluid-2xs text-gray-500 tabular-nums">접수 {item.inquiryNumber}</div>
                    )}
                    <div className="mt-0.5 text-fluid-xs text-gray-600 break-words">{line || '—'}</div>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-fluid-2xs">
                      {mapLine ? (
                        <>
                          {hit ? (
                            <span className="text-emerald-700">지도 표시됨</span>
                          ) : phase === 'ready' ? (
                            <span className="text-gray-400">지도 미표시</span>
                          ) : null}
                          <a
                            href={kakaoMapSearchUrl(mapLine)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            카카오맵
                          </a>
                          <a
                            href={googleMapSearchUrl(mapLine)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            구글맵
                          </a>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {phase === 'loading' && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 sm:px-5">
            <div className="mx-auto max-w-md">
              <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-[width] duration-200 ease-out"
                  style={{ width: `${loadPct}%` }}
                  role="progressbar"
                  aria-valuenow={loadPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="지오코딩 진행률"
                />
              </div>
              <p className="text-center text-fluid-sm font-semibold tabular-nums text-gray-900">{loadPct}%</p>
              <p className="mt-1 text-center text-fluid-xs text-gray-600">{loadDetail || '불러오는 중…'}</p>
            </div>
          </div>
        )}
        {phase === 'error' && errorMsg && (
          <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-center text-fluid-sm text-red-700">
            {errorMsg}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
