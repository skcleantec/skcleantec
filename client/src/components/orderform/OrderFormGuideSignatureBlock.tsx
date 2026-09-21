import { SignaturePad } from '../e-contract/SignaturePad';
import { LineMdIcon } from '../ui/LineMdIcon';

function blobToPngDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('서명을 읽지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}

export function OrderFormGuideSignatureBlock(props: {
  disabled: boolean;
  onSigned: (signaturePng: string) => void;
  existingUrl?: string | null;
  viewOnly?: boolean;
}) {
  const { disabled, onSigned, existingUrl, viewOnly = false } = props;
  const url = existingUrl?.trim() || '';

  if (viewOnly) {
    if (!url) return null;
    return (
      <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <h3 className="text-fluid-sm font-semibold text-slate-900">서명</h3>
        <img
          src={url}
          alt="고객 서명"
          className="mt-2 max-h-28 w-full rounded-md border border-slate-200 bg-white object-contain"
        />
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <LineMdIcon name="pencil" className="size-5 text-slate-700" />
        <h3 className="text-fluid-sm font-semibold text-slate-900">안내사항에 동의하는 서명</h3>
      </div>
      <p className="mt-1.5 text-fluid-xs leading-relaxed text-slate-600">
        이름을 그려 주세요. 서명하면 안내사항 동의가 끝납니다.
      </p>
      {disabled ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-2xs font-medium text-amber-950">
          먼저 안내를 맨 아래까지 내려 주세요.
        </p>
      ) : null}
      <SignaturePad
        disabled={disabled}
        minStrokePoints={8}
        saveButtonLabel="서명으로 동의"
        hint="손가락·펜·마우스로 박스 안에 서명을 그려 주세요."
        canvasHeightClass="h-36 sm:h-44"
        saveButtonClassName="w-full min-h-11 rounded-lg bg-slate-900 px-4 py-2.5 text-fluid-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        onSave={async (blob) => {
          const png = await blobToPngDataUrl(blob);
          if (!png.startsWith('data:image/png')) {
            throw new Error('서명 그림을 만들지 못했습니다.');
          }
          onSigned(png);
        }}
      />
    </section>
  );
}
