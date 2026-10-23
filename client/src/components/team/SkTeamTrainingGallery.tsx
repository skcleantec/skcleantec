import { useEffect, useRef, useState } from 'react';
import {
  fetchTeamLeaderTrainingImageBlob,
  fetchTeamLeaderTrainingImages,
} from '../../api/teamLeaderTraining';
import { useIsLgUp } from '../../hooks/useMediaQuery';
import { isCbiseoStaffNativeApp } from '../../utils/cbiseoNativeApp';
import { SkTeamTrainingSlideViewer } from './SkTeamTrainingSlideViewer';

type Slide = { index: number; title: string };

function TrainingSlide({
  token,
  slide,
  total,
}: {
  token: string;
  slide: Slide;
  total: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [enabled, setEnabled] = useState(slide.index < 2);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || enabled) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setEnabled(true);
      },
      { rootMargin: '800px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let url = '';
    let cancel = false;
    setFailed(false);
    fetchTeamLeaderTrainingImageBlob(token, slide.index)
      .then((blob) => {
        if (cancel) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {
        if (!cancel) setFailed(true);
      });
    return () => {
      cancel = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [enabled, token, slide.index]);

  return (
    <figure ref={ref} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <figcaption className="px-2.5 py-1.5 text-fluid-2xs text-slate-500">
        {slide.index + 1} / {total} · {slide.title}
      </figcaption>
      {src ? (
        <img src={src} alt={slide.title} className="block h-auto w-full" />
      ) : (
        <div className="flex min-h-40 items-center justify-center px-3 text-center text-fluid-xs text-slate-400">
          {failed ? '이 장을 불러오지 못했습니다.' : '불러오는 중…'}
        </div>
      )}
    </figure>
  );
}

export function SkTeamTrainingGallery({ token }: { token: string }) {
  const isLgUp = useIsLgUp();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState<Slide[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetchTeamLeaderTrainingImages(token)
      .then((data) => {
        if (!cancel) setItems(data.items);
      })
      .catch((e) => {
        if (!cancel) setErr(e instanceof Error ? e.message : '교육자료를 불러올 수 없습니다.');
      });
    return () => {
      cancel = true;
    };
  }, [token]);

  if (err) {
    return (
      <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-fluid-sm text-rose-800" role="alert">
        {err}
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-fluid-sm text-gray-500">
        교육자료 불러오는 중…
      </div>
    );
  }

  const slideButton = (
    <button
      ref={openButtonRef}
      type="button"
      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-fluid-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      onClick={() => setViewerOpen(true)}
    >
      자료보기
    </button>
  );
  const viewer = viewerOpen ? (
    <SkTeamTrainingSlideViewer
      token={token}
      items={items}
      onClose={() => {
        setViewerOpen(false);
        openButtonRef.current?.focus();
      }}
    />
  ) : null;

  if (!isLgUp || isCbiseoStaffNativeApp()) {
    return (
      <div className="flex flex-col gap-2">
        {slideButton}
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-600">
          자료보기를 누르면 메뉴 없이 장 전체가 보입니다. 두 손가락으로 키우거나 줄이고, 좌우로 넘기거나 옮깁니다. 뒤로 가면 닫힙니다.
        </p>
        {viewer}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {slideButton}
      {viewer}
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-600">
        아래로 넘기며 보세요. 모두 {items.length}장입니다.
      </p>
      {items.map((slide) => (
        <TrainingSlide key={slide.index} token={token} slide={slide} total={items.length} />
      ))}
    </div>
  );
}
