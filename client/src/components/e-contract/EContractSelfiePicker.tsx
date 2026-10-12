const SELFIE_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif';

type PickerProps = {
  busy: boolean;
  onPicked: (file: File) => void;
};

/**
 * iOS·앱 WebView는 `display:none` 입력을 스크립트로 누르면 카메라가 열리지 않는다.
 * 버튼 크기의 투명 input을 직접 눌러야 촬영·앨범이 뜬다.
 */
export function EContractSelfiePicker({ busy, onPicked }: PickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <SelfieFileLabel label="카메라로 촬영" capture="user" busy={busy} onPicked={onPicked} />
      <SelfieFileLabel label="앨범에서 고르기" busy={busy} onPicked={onPicked} />
    </div>
  );
}

function SelfieFileLabel({
  label,
  capture,
  busy,
  onPicked,
}: PickerProps & { label: string; capture?: 'user' }) {
  return (
    <label
      className={`relative flex min-h-11 w-full items-center justify-center rounded-xl px-3 py-3.5 text-fluid-sm font-semibold touch-manipulation focus-within:outline-none focus-within:ring-2 focus-within:ring-slate-400 focus-within:ring-offset-2 ${
        capture
          ? 'bg-slate-900 text-white'
          : 'border border-slate-300 bg-white text-slate-900'
      } ${busy ? 'pointer-events-none opacity-50' : ''}`}
    >
      <span>{label}</span>
      <input
        type="file"
        accept={SELFIE_ACCEPT}
        capture={capture}
        disabled={busy}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:pointer-events-none"
        onChange={(ev) => {
          const file = ev.target.files?.[0] ?? null;
          ev.target.value = '';
          if (file) onPicked(file);
        }}
      />
    </label>
  );
}
