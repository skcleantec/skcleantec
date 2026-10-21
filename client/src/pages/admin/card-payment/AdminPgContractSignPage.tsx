import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EContractFillStepper } from '../../../components/e-contract/EContractFillStepper';
import { SignaturePad } from '../../../components/e-contract/SignaturePad';
import { emptyFieldValues } from '../../../components/e-contract/EContractDynamicFieldInputs';
import { useLoginScrollSurface } from '../../../hooks/useMobileInputVisibility';
import { API } from '../../../api/apiPrefix';
import { getToken } from '../../../stores/auth';
import type { PublicSignFieldDto } from '../../../api/eContractPublic';

type ContractPayload = {
  ready: boolean;
  reason?: string;
  signed?: boolean;
  title?: string;
  bodyHtml?: string;
  fields?: PublicSignFieldDto[];
  values?: Record<string, string>;
};

async function uploadBlob(blob: Blob, filename: string) {
  const token = getToken();
  const body = new FormData();
  body.append('file', blob, filename);
  const res = await fetch(`${API}/card-payments/pg/contract/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; secureUrl?: string };
  if (!res.ok || !data.secureUrl) throw new Error(data.error || '올리지 못했습니다.');
  return { secureUrl: data.secureUrl };
}

export function AdminPgContractSignPage() {
  const navigate = useNavigate();
  const { scrollRef, onFieldFocus } = useLoginScrollSurface();
  const [payload, setPayload] = useState<ContractPayload | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    void fetch(`${API}/card-payments/pg/contract`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = (await res.json()) as ContractPayload & { error?: string };
        if (!res.ok) throw new Error(data.error || '불러오지 못했습니다.');
        return data;
      })
      .then((data) => {
        setPayload(data);
        setValues(emptyFieldValues(data.fields ?? [], data.values));
      })
      .catch((e: unknown) => setMsg(e instanceof Error ? e.message : '불러오지 못했습니다.'));
  }, []);

  const back = () => navigate(-1);

  const submit = async () => {
    const token = getToken();
    if (!token || !signatureUrl) {
      setMsg('서명을 저장해 주세요.');
      return;
    }
    if (!agree) {
      setMsg('계약 내용에 동의해 주세요.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/card-payments/pg/contract`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ signerFields: values, signatureUrl, agree: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || '저장하지 못했습니다.');
      setMsg('전자계약을 마쳤습니다.');
      setPayload((prev) => (prev ? { ...prev, signed: true } : prev));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={scrollRef}
      onFocusCapture={onFieldFocus}
      className="login-surface mx-auto min-h-dvh w-full max-w-lg overflow-y-auto overscroll-y-contain px-3 py-4"
    >
      <button
        type="button"
        onClick={back}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-fluid-xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        뒤로
      </button>
      <h1 className="mt-3 text-fluid-lg font-semibold text-slate-900">{payload?.title || '전자계약'}</h1>
      <p className="mt-1 text-fluid-2xs text-slate-600">PG 승인이 난 다음 단계입니다. 칸을 하나씩 적고 체크합니다.</p>
      {msg ? <p className="mt-3 text-fluid-xs text-slate-800">{msg}</p> : null}
      {payload && !payload.ready ? <p className="mt-4 text-fluid-sm text-slate-600">{payload.reason}</p> : null}
      {payload?.ready && payload.signed ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-fluid-sm text-emerald-900">
          전자계약을 마쳤습니다.
        </p>
      ) : null}
      {payload?.bodyHtml ? (
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="prose-sm max-w-none text-fluid-xs text-slate-800" dangerouslySetInnerHTML={{ __html: payload.bodyHtml }} />
        </section>
      ) : null}
      {payload?.ready && !payload.signed && (payload.fields?.length ?? 0) > 0 ? (
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
          <EContractFillStepper
            fields={payload.fields ?? []}
            values={values}
            onChange={(token, value) => setValues((prev) => ({ ...prev, [token]: value }))}
            uploadToken=""
            uploadBlob={uploadBlob}
            signatureAnchorId="pg-contract-sign"
          />
        </section>
      ) : null}
      {payload?.ready && !payload.signed ? (
        <>
          <section id="pg-contract-sign" className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-fluid-sm font-semibold text-slate-900">서명</p>
            <SignaturePad
              busy={busy}
              onSave={async (blob) => {
                const up = await uploadBlob(blob, `signature_${Date.now()}.png`);
                setSignatureUrl(up.secureUrl);
              }}
              onClear={() => setSignatureUrl(null)}
            />
          </section>
          <label className="mt-4 flex min-h-10 items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-fluid-xs text-slate-800">
            <input type="checkbox" checked={agree} onChange={(ev) => setAgree(ev.target.checked)} />
            위 계약 내용을 확인하고 동의합니다.
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="mt-3 flex min-h-10 w-full items-center justify-center rounded-lg bg-slate-900 text-fluid-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            계약 제출
          </button>
        </>
      ) : null}
    </div>
  );
}
