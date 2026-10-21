import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PgContractBook } from '../../../components/card-payment/pg-contract/PgContractBook';
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
        setValues(data.values ?? {});
      })
      .catch((e: unknown) => setMsg(e instanceof Error ? e.message : '불러오지 못했습니다.'));
  }, []);

  const back = () => navigate(-1);

  const submit = async () => {
    const token = getToken();
    const signatureUrl = values['[[EC_SIGNATURE]]'] || '';
    if (!token || !signatureUrl.startsWith('https://')) {
      setMsg('12쪽에서 서명을 저장해 주세요.');
      return;
    }
    if (values['[[EC_CHECK]]'] !== 'Y') {
      setMsg('12쪽에서 계약 내용에 동의해 주세요.');
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
      const data = (await res.json().catch(() => ({}))) as { error?: string; contractNo?: string };
      if (!res.ok) throw new Error(data.error || '저장하지 못했습니다.');
      if (data.contractNo) setValues((prev) => ({ ...prev, pgContractNo: data.contractNo as string }));
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
      className="login-surface mx-auto min-h-dvh w-full max-w-3xl overflow-y-auto overscroll-y-contain px-3 py-4"
    >
      <button
        type="button"
        onClick={back}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-fluid-xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        뒤로
      </button>
      <h1 className="mt-3 text-fluid-lg font-semibold text-slate-900">{payload?.title || '전자계약'}</h1>
      <p className="mt-1 text-fluid-2xs text-slate-600">A4 한 장씩 넘깁니다. 칸과 체크는 그 장 안에서 하고, 9장에서 도장과 서명을 남깁니다.</p>
      {msg ? <p className="mt-3 text-fluid-xs text-slate-800">{msg}</p> : null}
      {payload && !payload.ready ? <p className="mt-4 text-fluid-sm text-slate-600">{payload.reason}</p> : null}
      {payload?.ready ? (
        <div className="mt-4">
          <PgContractBook
            mode={payload.signed ? 'read' : 'sign'}
            values={values}
            contractNo={values.pgContractNo}
            onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
            uploadBlob={uploadBlob}
            busy={busy}
            onSubmit={() => void submit()}
          />
        </div>
      ) : null}
    </div>
  );
}
