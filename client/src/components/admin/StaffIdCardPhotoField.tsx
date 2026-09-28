import { useEffect, useRef, useState } from 'react';
import { LineMdIcon } from '../ui/LineMdIcon';
import {
  downloadRemoteImage,
  ImageThumbLightbox,
} from '../ui/ImageThumbLightbox';

const BTN =
  'inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function staffIdCardFileName(personName: string): string {
  const safe = personName.replace(/[\\/:*?"<>|]+/g, '').trim() || '사원증';
  return `사원증_${safe}`;
}

export function StaffIdCardPhotoField({
  url,
  personName,
  disabled,
}: {
  url: string;
  personName: string;
  disabled?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [saving, setSaving] = useState(false);
  const [broken, setBroken] = useState(false);
  const fileName = staffIdCardFileName(personName);
  const alt = personName.trim() ? `${personName.trim()} 사원증` : '사원증 사진';

  useEffect(() => {
    setBroken(false);
  }, [url]);

  return (
    <div className="space-y-2">
      <ImageThumbLightbox
        src={url}
        alt={alt}
        showDownload
        triggerRef={triggerRef}
        gallerySlides={[{ src: url, alt, title: '사원증 사진', downloadFilename: fileName }]}
        thumbClassName="max-h-52 w-full cursor-zoom-in rounded border border-slate-200 bg-white object-contain"
        buttonClassName="block w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-0 ring-inset hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        onThumbError={() => setBroken(true)}
      />
      <p className="text-fluid-2xs text-slate-500">
        {broken ? '사진 주소를 열 수 없습니다. 「사진 교체」로 다시 올려 주세요.' : '사진을 누르면 크게 볼 수 있습니다.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BTN}
          disabled={disabled || broken}
          onClick={() => triggerRef.current?.click()}
        >
          <LineMdIcon name="image" className="size-4 text-slate-600" />
          미리보기
        </button>
        <button
          type="button"
          className={BTN}
          disabled={disabled || saving}
          onClick={() => {
            setSaving(true);
            void downloadRemoteImage(url, fileName).finally(() => setSaving(false));
          }}
        >
          <LineMdIcon name="download" className="size-4 text-slate-600" />
          {saving ? '저장 중…' : '다운로드'}
        </button>
      </div>
    </div>
  );
}
