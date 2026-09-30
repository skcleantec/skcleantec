import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Pin = { lat: number; lng: number; label: string; color: string };

export function AiDispatchRouteMap({ pins }: { pins: Pin[] }) {
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
    return <p className="text-fluid-2xs text-slate-500">위치를 찾지 못했습니다.</p>;
  }

  return <div ref={ref} className="h-36 w-full overflow-hidden rounded-lg border border-slate-200" />;
}
