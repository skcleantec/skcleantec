import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LineMdIcon } from '../../ui/LineMdIcon';

type Pin = { lat: number; lng: number; label: string; color: string };

export function AiDispatchRouteMap({ pins, className }: { pins: Pin[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pinKey = pins.map((pin) => `${pin.label}:${pin.lat}:${pin.lng}`).join('|');

  useEffect(() => {
    const el = ref.current;
    if (!el || pins.length === 0) return;
    const map = L.map(el, { attributionControl: false, zoomControl: false, scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
    const layer = L.featureGroup();
    for (const pin of pins) {
      L.circleMarker([pin.lat, pin.lng], {
        radius: 7,
        color: pin.color,
        fillColor: pin.color,
        fillOpacity: 0.95,
        weight: 2,
      })
        .bindTooltip(pin.label, { permanent: true, direction: 'top', opacity: 0.9 })
        .addTo(layer);
    }
    layer.addTo(map);
    map.fitBounds(layer.getBounds().pad(0.4), { maxZoom: 13 });
    const timer = window.setTimeout(() => map.invalidateSize(), 60);
    return () => {
      window.clearTimeout(timer);
      map.remove();
    };
    // pinKey가 바뀌면 핀 좌표도 같은 렌더의 pins와 같다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinKey]);

  if (pins.length === 0) {
    return (
      <div className={`flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-fluid-2xs text-slate-500 ${className ?? 'aspect-square w-full'}`}>
        위치를 찾지 못했습니다
      </div>
    );
  }

  return <div ref={ref} className={`overflow-hidden rounded-lg border border-slate-200 ${className ?? 'aspect-square w-full'}`} />;
}

export function AiDispatchMapPreview({ pins }: { pins: Pin[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-28 shrink-0">
      <AiDispatchRouteMap pins={pins} className="aspect-square w-full" />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 flex min-h-9 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-1 text-fluid-2xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        크게보기
      </button>
      {open
        ? createPortal(
            <div
              className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center"
              role="presentation"
              onClick={() => setOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="배정 지도"
                className="modal-mobile-fullscreen-panel flex max-h-[min(92vh,40rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                  <p className="text-fluid-sm font-semibold text-slate-900">출발 · 오전 · 오후</p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    aria-label="닫기"
                  >
                    <LineMdIcon name="close" className="size-5" />
                  </button>
                </header>
                <div className="min-h-0 flex-1 p-2">
                  <AiDispatchRouteMap pins={pins} className="h-[min(70vh,32rem)] w-full" />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
