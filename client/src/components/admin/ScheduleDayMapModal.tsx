import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ScheduleItem } from '../../api/schedule';
import type { GeocodeBatchMeta, GeocodeBatchResultRow } from '../../api/geocode';
import { geocodeAddressBatch } from '../../api/geocode';
import { ModalCloseButton } from './ModalCloseButton';

const MAX_GEOCODE = 35;

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

/** 1차(도로명) 실패 시 전체주소·괄호 제거 등으로 최대 몇 차례 추가 배치 호출 */
async function geocodeRowsWithRetryPasses(
  token: string,
  list: Array<{ item: ScheduleItem; query: string }>
): Promise<{ results: GeocodeBatchResultRow[]; meta?: GeocodeBatchMeta }> {
  const primaryQueries = list.map((r) => r.query);
  const { results: r0, meta } = await geocodeAddressBatch(token, primaryQueries);
  const work: GeocodeBatchResultRow[] = r0.map((row, i) => ({
    ...row,
    query: list[i]!.query,
  }));
  const attempted = new Set<string>(primaryQueries);

  for (let round = 0; round < 3; round++) {
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
    for (let off = 0; off < keys.length; off += 35) {
      const chunk = keys.slice(off, off + 35);
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
    }
  }
  return { results: work, meta };
}

type Placed = {
  id: string;
  customerName: string;
  inquiryNumber?: string | null;
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
  const [progress, setProgress] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [skippedNoAddress, setSkippedNoAddress] = useState(0);
  const [skippedCap, setSkippedCap] = useState(0);
  const [geocodeMissCount, setGeocodeMissCount] = useState(0);
  const [kakaoApiConfigured, setKakaoApiConfigured] = useState(false);
  const [googleGeocodingConfigured, setGoogleGeocodingConfigured] = useState(false);

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
      setGoogleGeocodingConfigured(false);
      setPhase(rows.list.length === 0 ? 'ready' : 'idle');
      return;
    }
    setPhase('loading');
    setErrorMsg(null);
    setProgress('주소를 지도 좌표로 변환하는 중입니다. 건수에 따라 1분 가까이 걸릴 수 있습니다.');
    setSkippedNoAddress(rows.skippedNoAddress);
    setSkippedCap(rows.skippedCap);
    try {
      const { results, meta } = await geocodeRowsWithRetryPasses(token, rows.list);
      setKakaoApiConfigured(meta?.kakaoApiConfigured ?? false);
      setGoogleGeocodingConfigured(meta?.googleGeocodingConfigured ?? false);
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
      setProgress(null);
    } catch (e) {
      setPhase('error');
      setErrorMsg(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
      setProgress(null);
    }
  }, [open, rows.list, rows.skippedCap, rows.skippedNoAddress, token]);

  useEffect(() => {
    if (!open) {
      setPhase('idle');
      setPlaced([]);
      setGeocodeMissCount(0);
      setKakaoApiConfigured(false);
      setGoogleGeocodingConfigured(false);
      setErrorMsg(null);
      setProgress(null);
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
      const title = p.inquiryNumber
        ? `${p.customerName} (${p.inquiryNumber})`
        : p.customerName;
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 8,
        color: '#1e40af',
        weight: 2,
        fillColor: '#2563eb',
        fillOpacity: 0.95,
      });
      m.bindPopup(
        `<div class="text-fluid-xs" style="min-width:12rem;max-width:18rem">
          <div style="font-weight:600;margin-bottom:4px">${escHtml(title)}</div>
          <div style="color:#444;line-height:1.35;margin-bottom:8px">${escHtml(p.addressLine)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px 12px">
            <a href="${kakaoMapSearchUrl(p.mapSearchLine)}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;text-decoration:underline">카카오맵</a>
            <a href="${googleMapSearchUrl(p.mapSearchLine)}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;text-decoration:underline">구글맵</a>
          </div>
        </div>`
      );
      const shortName = truncateMapLabel(p.customerName, 12);
      m.bindTooltip(
        `<span class="schedule-map-name-inner" title="${escAttr(p.customerName)}">${escHtml(shortName)}</span>`,
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
          margin-top: -2px;
          padding: 2px 7px;
          border: 1px solid #e5e7eb;
          border-radius: 5px;
          background: rgba(255,255,255,0.96);
          color: #111827;
          font-size: 11px;
          font-weight: 600;
          line-height: 1.25;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          pointer-events: none !important;
        }
        .leaflet-tooltip.schedule-map-marker-name .schedule-map-name-inner {
          display: block;
          max-width: 7rem;
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
          <p className="mt-1 text-fluid-xs text-gray-500">
            지오코딩·지도 링크 검색어는 접수 시 카카오 주소로 넣은 도로명·번지(`address`)만 쓰고, 동·호 등 상세(`addressDetail`)는 붙이지 않습니다.
            OpenStreetMap 타일 + Nominatim으로 좌표를 구한 뒤, 서버 설정 시 카카오 로컬 API → Google Geocoding 순으로
            실패 건을 추가 변환합니다.
            {kakaoApiConfigured || googleGeocodingConfigured
              ? ` (현재: ${[kakaoApiConfigured ? '카카오' : '', googleGeocodingConfigured ? '구글' : '']
                  .filter(Boolean)
                  .join(', ')} 지오코딩 사용)`
              : ' KAKAO_REST_API_KEY·GOOGLE_MAPS_API_KEY는 server/.env(또는 저장소 루트 .env)에 넣으면 같은 지도에 마커가 더 잘 붙습니다.'}
            위치가 어긋날 수 있으면 카카오맵·구글맵 링크로 확인하세요.
          </p>
          {(skippedNoAddress > 0 || skippedCap > 0 || geocodeMissCount > 0) && (
            <p className="mt-2 text-fluid-xs text-amber-800">
              {skippedNoAddress > 0 ? `주소 없음 ${skippedNoAddress}건은 표에서만 보입니다. ` : ''}
              {skippedCap > 0 ? `지도 변환은 최대 ${MAX_GEOCODE}건까지 처리했습니다. (${skippedCap}건 생략)` : ''}
              {geocodeMissCount > 0
                ? `좌표를 찾지 못한 접수 ${geocodeMissCount}건은 지도에 마커가 없습니다. 카카오맵·구글맵 링크로 확인해 주세요.${
                    !kakaoApiConfigured && !googleGeocodingConfigured
                      ? ' (server/.env 또는 루트 .env에 KAKAO_REST_API_KEY 또는 GOOGLE_MAPS_API_KEY를 넣고 서버를 재시작하면 이 지도에도 마커가 더 잘 붙습니다.)'
                      : ''
                  }`
                : ''}
            </p>
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
                return (
                  <li key={item.id} className="px-3 py-2.5 sm:px-4">
                    <div className="font-medium text-gray-900">{item.customerName}</div>
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
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-center text-fluid-sm text-gray-600">
            {progress ?? '불러오는 중…'}
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
