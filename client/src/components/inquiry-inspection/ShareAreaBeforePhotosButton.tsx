import { useState } from 'react';
import type { InspectionArea } from '../../api/inquiryInspection';
import { shareImageFiles, type ShareImageItem, DESKTOP_SHARE_HINT, CLIPBOARD_SHARE_HINT } from '../../utils/shareFiles';

function safeNamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 20);
}

function listAreaBeforePhotoItems(area: InspectionArea): ShareImageItem[] {
  const items: ShareImageItem[] = [];
  const areaPart = safeNamePart(area.label) || 'area';
  for (const item of area.items) {
    if (item.itemKey.startsWith('_') || item.notApplicable) continue;
    const itemPart = safeNamePart(item.label) || 'item';
    const beforePhotos = item.photos.filter((p) => p.phase === 'BEFORE');
    beforePhotos.forEach((photo, idx) => {
      items.push({
        url: photo.secureUrl,
        filename: `${areaPart}_${itemPart}_${String(idx + 1).padStart(2, '0')}`,
      });
    });
  }
  return items;
}

export function ShareAreaBeforePhotosButton({
  area,
  customerName,
  preferredDate,
  disabled,
  className = '',
  variant = 'light',
}: {
  token: string;
  inquiryId: string;
  area: InspectionArea;
  customerName?: string;
  preferredDate?: string | null;
  disabled?: boolean;
  className?: string;
  /** light: 구역 카드(밝은 배경) · dark: 촬영 오버레이 등 */
  variant?: 'light' | 'dark';
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const photoItems = listAreaBeforePhotoItems(area);
  const photoCount = photoItems.length;
  const canShare = photoCount > 0 && !area.notApplicable;

  const handleShare = async () => {
    if (!canShare || busy || disabled) return;
    setBusy(true);
    setProgress({ done: 0, total: photoCount });
    try {
      const dateLabel = preferredDate
        ? new Date(preferredDate).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
        : '';
      const title = `[청소 전] ${customerName ?? '현장'} · ${area.label}`;
      const text = [
        title,
        dateLabel ? `서비스일 ${dateLabel}` : '',
        `${area.label} 청소 전 사진 ${photoCount}장입니다. 확인 후 궁금한 점이나 추가 요청 사항 알려 주세요.`,
      ]
        .filter(Boolean)
        .join('\n');

      const result = await shareImageFiles({
        images: photoItems,
        title,
        text,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      if (result === 'desktop') {
        alert(DESKTOP_SHARE_HINT);
      } else if (result === 'clipboard') {
        alert(CLIPBOARD_SHARE_HINT);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '전달 준비에 실패했습니다.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const baseClass =
    variant === 'dark'
      ? 'border-white/25 bg-white/10 text-white hover:bg-white/15'
      : 'border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100';

  const busyLabel =
    progress && progress.total > 0
      ? `준비 중 (${progress.done}/${progress.total})`
      : '준비 중…';

  return (
    <button
      type="button"
      disabled={disabled || busy || !canShare}
      onClick={() => void handleShare()}
      title={canShare ? '카카오톡 등으로 사진 바로 전달' : '전달할 청소 전 사진이 없습니다'}
      className={`min-h-[36px] rounded-lg border px-2 py-1.5 text-fluid-2xs font-medium touch-manipulation disabled:opacity-45 ${baseClass} ${className}`}
    >
      {busy ? busyLabel : `전달하기${canShare ? ` (${photoCount})` : ''}`}
    </button>
  );
}
