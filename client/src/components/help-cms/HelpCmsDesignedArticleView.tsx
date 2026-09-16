import { useLayoutEffect, useRef } from 'react';
import { DESIGNED_ARTICLE_SCOPE_CLASS } from './helpCmsDesignedArticleCss';

type Props = {
  html: string;
  className?: string;
  editable?: boolean;
  onHtmlChange?: (html: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
};

function serializeDesignedRoot(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
  clone.querySelectorAll('[data-editor-img]').forEach((el) => el.removeAttribute('data-editor-img'));
  return clone.innerHTML;
}

function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null;
      input.remove();
      resolve(file);
    });
    document.body.appendChild(input);
    input.click();
    window.setTimeout(() => {
      if (!input.files?.length) {
        /* 취소해도 change가 안 오는 브라우저 대비 */
      }
    }, 0);
  });
}

/** 완성 HTML 공지 — 공개는 보기, 에디터에서는 문구·사진 수정 */
export function HelpCmsDesignedArticleView({
  html,
  className,
  editable = false,
  onHtmlChange,
  onUploadImage,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const skipPropHtmlRef = useRef(false);
  const onHtmlChangeRef = useRef(onHtmlChange);
  const onUploadImageRef = useRef(onUploadImage);
  onHtmlChangeRef.current = onHtmlChange;
  onUploadImageRef.current = onUploadImage;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (skipPropHtmlRef.current) {
      skipPropHtmlRef.current = false;
    } else if (root.innerHTML !== html) {
      root.innerHTML = html;
    }

    let debounceId = 0;
    const emitChange = (immediate = false) => {
      const fire = () => {
        skipPropHtmlRef.current = true;
        onHtmlChangeRef.current?.(serializeDesignedRoot(root));
      };
      window.clearTimeout(debounceId);
      if (immediate) {
        fire();
        return;
      }
      debounceId = window.setTimeout(fire, 400);
    };

    const live = /(^|\.)cbiseo\.com$/.test(window.location.hostname);
    const onImgError = (event: Event) => {
      const img = event.currentTarget as HTMLImageElement;
      const fig = img.closest('.shot');
      if (!(fig instanceof HTMLElement)) return;
      if (live && !editable) fig.hidden = true;
      else fig.classList.add('empty');
    };

    const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
    imgs.forEach((img) => {
      if (img.classList.contains('capture')) {
        img.addEventListener('error', onImgError);
        if (img.complete && img.naturalWidth === 0) {
          onImgError({ currentTarget: img } as unknown as Event);
        }
      }
      if (editable) {
        img.setAttribute('data-editor-img', '1');
        img.title = '클릭하면 사진을 바꿉니다';
      }
    });

    const article = root.querySelector<HTMLElement>(`.${DESIGNED_ARTICLE_SCOPE_CLASS}`);
    if (editable && article) {
      article.setAttribute('contenteditable', 'true');
      article.setAttribute('spellcheck', 'true');
    }

    const stopPm = (event: Event) => {
      event.stopPropagation();
    };

    const applyImageFile = async (img: HTMLImageElement, file: File) => {
      const upload = onUploadImageRef.current;
      if (!upload) return;
      const url = await upload(file);
      img.src = url;
      img.removeAttribute('srcset');
      img.closest('.shot')?.classList.remove('empty');
      const fig = img.closest('.shot');
      if (fig instanceof HTMLElement) fig.hidden = false;
      emitChange(true);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (editable) {
        const img = target.closest('img');
        if (img instanceof HTMLImageElement) {
          event.preventDefault();
          event.stopPropagation();
          void pickImageFile().then((file) => {
            if (file) void applyImageFile(img, file);
          });
          return;
        }
      }

      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      if (href.startsWith('#') && href !== '#') {
        const id = decodeURIComponent(href.slice(1));
        const dest = id ? root.querySelector(`#${CSS.escape(id)}`) : null;
        if (dest) {
          event.preventDefault();
          dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }
      if (editable) {
        event.preventDefault();
      }
    };

    const onInput = () => {
      if (!editable) return;
      emitChange(false);
    };

    const onBlur = () => {
      if (!editable) return;
      emitChange(true);
    };

    const onDragOver = (event: DragEvent) => {
      if (!editable) return;
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const onDrop = (event: DragEvent) => {
      if (!editable) return;
      const file = Array.from(event.dataTransfer?.files ?? []).find(
        (f) => f.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name),
      );
      if (!file) return;
      const target = event.target;
      const img =
        target instanceof Element
          ? target.closest('img') ?? root.querySelector<HTMLImageElement>('img.capture, img')
          : null;
      if (!(img instanceof HTMLImageElement)) return;
      event.preventDefault();
      event.stopPropagation();
      void applyImageFile(img, file);
    };

    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('blur', onBlur, true);
    if (editable && article) {
      article.addEventListener('keydown', stopPm);
      article.addEventListener('mousedown', stopPm);
      article.addEventListener('dragover', onDragOver);
      article.addEventListener('drop', onDrop);
    }

    return () => {
      imgs.forEach((img) => img.removeEventListener('error', onImgError));
      window.clearTimeout(debounceId);
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
      root.removeEventListener('blur', onBlur, true);
      if (article) {
        article.removeEventListener('keydown', stopPm);
        article.removeEventListener('mousedown', stopPm);
        article.removeEventListener('dragover', onDragOver);
        article.removeEventListener('drop', onDrop);
      }
    };
  }, [html, editable]);

  return (
    <div
      ref={rootRef}
      className={className}
      {...(!editable ? { dangerouslySetInnerHTML: { __html: html } } : {})}
    />
  );
}
