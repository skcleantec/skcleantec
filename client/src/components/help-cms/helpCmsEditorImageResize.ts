export type DesignedImageResizeOptions = {
  onCommit: (img: HTMLImageElement) => void;
  onReplace?: (img: HTMLImageElement) => void;
  /** 이 조상 안의 사진은 건너뜀 (완성 HTML 블록은 자체 조절을 씀) */
  ignoreClosest?: string;
};

function resizeTarget(img: HTMLImageElement): HTMLElement {
  const frame = img.closest('.frame');
  if (frame instanceof HTMLElement) return frame;
  const figure = img.closest('figure');
  if (figure instanceof HTMLElement) return figure;
  return img;
}

function applyWidth(target: HTMLElement, img: HTMLImageElement, pct: number) {
  const next = Math.min(100, Math.max(16, Math.round(pct)));
  target.style.width = `${next}%`;
  target.style.maxWidth = '100%';
  if (target !== img) target.style.display = 'block';
  if (target !== img) {
    img.style.width = '100%';
    img.style.height = 'auto';
  } else {
    img.style.height = 'auto';
  }
}

function parentWidth(target: HTMLElement): number {
  const parent = target.parentElement;
  return parent?.clientWidth || target.clientWidth || 1;
}

/** 에디터에서 사진·사진 칸 크기를 끌어 조절 */
export function attachDesignedImageResize(
  root: HTMLElement,
  opts: DesignedImageResizeOptions,
): { destroy: () => void } {
  const ui = document.createElement('div');
  ui.setAttribute('data-img-resize-ui', '1');
  ui.className = 'cbiseo-img-resize-ui';
  ui.hidden = true;
  ui.innerHTML = `
    <div class="cbiseo-img-resize-box"></div>
    <button type="button" class="cbiseo-img-resize-handle" data-handle="se" aria-label="크기 조절"></button>
    <div class="cbiseo-img-resize-bar">
      <button type="button" data-pct="33">작게</button>
      <button type="button" data-pct="50">절반</button>
      <button type="button" data-pct="75">크게</button>
      <button type="button" data-pct="100">가득</button>
      <button type="button" data-replace="1">사진 바꾸기</button>
    </div>
  `;
  root.appendChild(ui);

  let selected: HTMLImageElement | null = null;
  let dragging = false;

  const boxEl = ui.querySelector('.cbiseo-img-resize-box') as HTMLElement;
  const handleEl = ui.querySelector('[data-handle="se"]') as HTMLElement;

  const layoutUi = () => {
    if (!selected || ui.hidden) return;
    const target = resizeTarget(selected);
    const host = root.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const top = rect.top - host.top + root.scrollTop;
    const left = rect.left - host.left + root.scrollLeft;
    ui.style.top = `${top}px`;
    ui.style.left = `${left}px`;
    ui.style.width = `${rect.width}px`;
    ui.style.height = `${rect.height}px`;
    boxEl.style.width = '100%';
    boxEl.style.height = '100%';
    handleEl.style.right = '-7px';
    handleEl.style.bottom = '-7px';
  };

  const select = (img: HTMLImageElement | null) => {
    root.querySelectorAll('img.cbiseo-img-selected').forEach((el) => el.classList.remove('cbiseo-img-selected'));
    selected = img;
    if (!img) {
      ui.hidden = true;
      return;
    }
    img.classList.add('cbiseo-img-selected');
    ui.hidden = false;
    layoutUi();
  };

  const onRootClick = (event: MouseEvent) => {
    const t = event.target;
    if (!(t instanceof Element)) return;
    if (t.closest('[data-img-resize-ui]')) return;
    const img = t.closest('img');
    if (img instanceof HTMLImageElement && root.contains(img)) {
      if (opts.ignoreClosest && img.closest(opts.ignoreClosest)) return;
      event.preventDefault();
      event.stopPropagation();
      select(img);
      return;
    }
    select(null);
  };

  const onBarClick = (event: MouseEvent) => {
    const btn = (event.target as Element | null)?.closest('button');
    if (!(btn instanceof HTMLButtonElement) || !selected) return;
    event.preventDefault();
    event.stopPropagation();
    if (btn.dataset.replace === '1') {
      opts.onReplace?.(selected);
      return;
    }
    const pct = Number(btn.dataset.pct);
    if (!Number.isFinite(pct)) return;
    applyWidth(resizeTarget(selected), selected, pct);
    layoutUi();
    opts.onCommit(selected);
  };

  const onHandleDown = (event: PointerEvent) => {
    if (!selected) return;
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    handleEl.setPointerCapture(event.pointerId);
  };

  const onHandleMove = (event: PointerEvent) => {
    if (!dragging || !selected) return;
    const target = resizeTarget(selected);
    const left = target.getBoundingClientRect().left;
    const pct = ((event.clientX - left) / parentWidth(target)) * 100;
    applyWidth(target, selected, pct);
    layoutUi();
  };

  const onHandleUp = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    try {
      handleEl.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    if (selected) opts.onCommit(selected);
  };

  const onScroll = () => layoutUi();

  ui.addEventListener('click', onBarClick);
  handleEl.addEventListener('pointerdown', onHandleDown);
  handleEl.addEventListener('pointermove', onHandleMove);
  handleEl.addEventListener('pointerup', onHandleUp);
  handleEl.addEventListener('pointercancel', onHandleUp);
  root.addEventListener('click', onRootClick, true);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);

  return {
    destroy: () => {
      select(null);
      ui.removeEventListener('click', onBarClick);
      handleEl.removeEventListener('pointerdown', onHandleDown);
      handleEl.removeEventListener('pointermove', onHandleMove);
      handleEl.removeEventListener('pointerup', onHandleUp);
      handleEl.removeEventListener('pointercancel', onHandleUp);
      root.removeEventListener('click', onRootClick, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      ui.remove();
    },
  };
}
