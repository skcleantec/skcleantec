import { useEffect, useState } from 'react';
import { PgContractBook } from '../../../components/card-payment/pg-contract/PgContractBook';
import { FeatureGate } from '../../../components/auth/FeatureGate';
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
  return (
    <FeatureGate module="mod_card_payment">
      <PgContractDesk />
    </FeatureGate>
  );
}

function PgContractDesk() {
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

  const closeDesk = () => {
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    window.location.assign('/admin/team-leaders/pg-onboarding');
  };

  const submit = async () => {
    const token = getToken();
    const signatureUrl = values['[[EC_SIGNATURE]]'] || '';
    if (!token || !signatureUrl.startsWith('https://')) {
      setMsg('서명 장에서 서명을 저장해 주세요.');
      return;
    }
    if (values['[[EC_CHECK]]'] !== 'Y') {
      setMsg('서명 장에서 계약 내용에 동의해 주세요.');
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
      setMsg('전자계약을 마쳤습니다. 이 창을 닫으면 신청 화면으로 돌아갑니다.');
      setPayload((prev) => (prev ? { ...prev, signed: true } : prev));
      window.opener?.postMessage({ type: 'pg-contract:signed' }, window.location.origin);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-slate-200">
      <header className="pg-no-print flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900 px-3 py-2 text-white">
        <p className="min-w-0 flex-1 truncate text-fluid-sm font-semibold">청소비서 · 카드결제 전자계약</p>
        <button
          type="button"
          onClick={closeDesk}
          className="min-h-9 shrink-0 rounded-lg border border-white/30 px-3 text-fluid-xs font-medium text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          닫기
        </button>
      </header>
      <div
        ref={scrollRef}
        onFocusCapture={onFieldFocus}
        className="pg-desk-scroll login-surface min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-4"
      >
        <div className="mx-auto w-full max-w-[220mm]">
          {msg ? <p className="pg-no-print mb-3 rounded-lg bg-white px-3 py-2 text-fluid-xs text-slate-800 shadow-sm">{msg}</p> : null}
          {!payload ? <p className="py-16 text-center text-fluid-sm text-slate-600">계약서를 불러오는 중…</p> : null}
          {payload && !payload.ready ? <p className="py-16 text-center text-fluid-sm text-slate-700">{payload.reason}</p> : null}
          {payload?.ready ? (
            <PgContractBook
              mode={payload.signed ? 'read' : 'sign'}
              values={values}
              contractNo={values.pgContractNo}
              onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
              uploadBlob={uploadBlob}
              busy={busy}
              onSubmit={() => void submit()}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
