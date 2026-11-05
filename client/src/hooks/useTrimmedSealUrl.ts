import { useEffect, useState } from 'react';
import { trimTransparentPngUrlToObjectUrl } from '../utils/quotationSealTrim';

/** 저장된 직인 URL의 투명 여백을 잘라 표시용 object URL을 만든다. */
export function useTrimmedSealUrl(sealUrl: string | null | undefined): string | null {
  const src = (sealUrl ?? '').trim() || null;
  const [trimmed, setTrimmed] = useState<string | null>(src);

  useEffect(() => {
    if (!src) {
      setTrimmed(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setTrimmed(src);
    void (async () => {
      try {
        const next = await trimTransparentPngUrlToObjectUrl(src);
        if (cancelled) {
          if (next.startsWith('blob:')) URL.revokeObjectURL(next);
          return;
        }
        objectUrl = next.startsWith('blob:') ? next : null;
        setTrimmed(next);
      } catch {
        if (!cancelled) setTrimmed(src);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return trimmed;
}
