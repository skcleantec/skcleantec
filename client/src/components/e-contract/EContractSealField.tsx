import { useId, useState } from 'react';
import { uploadEContractBlob } from '../../api/eContractPublic';
import { knockoutSealPaper } from '../../utils/sealPaperKnockout';

type Props = {
  label: string;
  required: boolean;
  value: string;
  uploadToken?: string;
  uploadBlob?: (blob: Blob, filename: string) => Promise<{ secureUrl: string }>;
  onChange: (url: string) => void;
};

export function EContractSealField({ label, required, value, uploadToken, uploadBlob, onChange }: Props) {
  const inputId = useId();
  const [threshold, setThreshold] = useState(36);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const blob = await knockoutSealPaper(file, threshold);
      if (preview) URL.revokeObjectURL(preview);
      const local = URL.createObjectURL(blob);
      setPreview(local);
      const filename = `seal_${Date.now()}.png`;
      const up = uploadBlob
        ? await uploadBlob(blob, filename)
        : await uploadEContractBlob(blob, uploadToken ?? '', filename);
      onChange(up.secureUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '도장을 올리지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const shown = preview || value;

  return (
    <div>
      <div className="text-fluid-xs font-medium text-gray-800">
        {label}
        {!required ? <span className="font-normal text-gray-500"> (선택)</span> : null}
      </div>
      <p className="mt-1 text-fluid-2xs leading-snug text-gray-600">
        흰 종이에 도장을 찍은 뒤 사진을 올리면, 종이색을 지운 그림으로 도장 칸에 넣습니다.
      </p>
      <label htmlFor={inputId} className="mt-2 block text-fluid-2xs text-gray-700">
        종이 지우기
        <input
          type="range"
          min={12}
          max={80}
          value={threshold}
          onChange={(ev) => setThreshold(Number(ev.target.value))}
          className="mt-1 block w-full"
        />
      </label>
      <label
        htmlFor={`${inputId}-file`}
        className="mt-3 flex min-h-10 cursor-pointer items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-within:ring-2 focus-within:ring-slate-400 focus-within:ring-offset-2"
      >
        {busy ? '만드는 중…' : '도장 사진 올리기'}
        <input
          id={`${inputId}-file`}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy}
          className="sr-only"
          onChange={(ev) => {
            const file = ev.target.files?.[0] ?? null;
            ev.target.value = '';
            void onFile(file);
          }}
        />
      </label>
      {err ? <p className="mt-2 text-fluid-2xs text-red-700">{err}</p> : null}
      {shown ? (
        <div className="mt-3 flex justify-center rounded-lg border border-dashed border-slate-300 bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%),linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px] p-3">
          <img src={shown} alt="배경을 지운 도장" className="h-24 w-24 object-contain" />
        </div>
      ) : null}
    </div>
  );
}
