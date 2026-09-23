import { useState } from 'react';
import { normalizeGuideTypedName } from '@shared/orderFormConsents';
import { SignaturePad } from '../e-contract/SignaturePad';
import { LineMdIcon } from '../ui/LineMdIcon';
import { OrderFormGuideSignProof } from './OrderFormConsentUi';

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
  onSigned: (payload: { signaturePng: string; typedName: string }) => void;
  existingUrl?: string | null;
  typedName?: string | null;
  agreedAt?: string | null;
  viewOnly?: boolean;
}) {
  const { disabled, onSigned, existingUrl, typedName, agreedAt, viewOnly = false } = props;
  const [nameDraft, setNameDraft] = useState('');

  if (viewOnly) {
    return (
      <OrderFormGuideSignProof
        className="mt-8"
        typedName={typedName}
        agreedAt={agreedAt}
        signatureUrl={existingUrl}
      />
    );
  }

  const validName = normalizeGuideTypedName(nameDraft);
  const padLocked = disabled || !validName;

  return (
    <section className="mt-8 space-y-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <LineMdIcon name="pencil" className="size-5 text-slate-700" />
        <h3 className="text-fluid-sm font-semibold text-slate-900">성함과 서명으로 동의</h3>
      </div>
      <p className="text-fluid-xs leading-relaxed text-slate-600">
        위에 성함을 직접 적고, 아래에 서명하면 모든 안내·위약 내용에 동의한 것으로 봅니다.
      </p>
      <label className="block space-y-1.5">
        <span className="text-fluid-2xs font-medium text-slate-700">고객작성 성함</span>
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          autoComplete="off"
          inputMode="text"
          maxLength={40}
          placeholder="예: 홍길동"
          className="login-field-input min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-fluid-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        />
      </label>
      {disabled ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-2xs font-medium text-amber-950">
          먼저 각 항목을 체크하고 안내를 맨 아래까지 내려 주세요.
        </p>
      ) : !validName ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs font-medium text-slate-700">
          성함을 두 글자 이상 적으면 아래에 서명할 수 있습니다.
        </p>
      ) : null}
      <div>
        <p className="mb-1.5 text-fluid-2xs font-medium text-slate-700">서명</p>
        <SignaturePad
          disabled={padLocked}
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
            const name = normalizeGuideTypedName(nameDraft);
            if (!name) {
              throw new Error('성함을 두 글자 이상 적어 주세요.');
            }
            onSigned({ signaturePng: png, typedName: name });
          }}
        />
      </div>
    </section>
  );
}
