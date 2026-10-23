import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearPgPartnerToken, readPgPartnerToken } from './pgPartnerSession';

const INPUT = 'login-field-input mt-1 w-full min-h-11 rounded-lg border border-slate-200 px-3 text-fluid-sm';
const BTN =
  'min-h-11 rounded-xl bg-slate-900 px-4 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function RailFields({
  title,
  hint,
  mid,
  oid,
  tid,
  apiKey,
  onMid,
  onOid,
  onTid,
  onApiKey,
}: {
  title: string;
  hint: string;
  mid: string;
  oid: string;
  tid: string;
  apiKey: string;
  onMid: (value: string) => void;
  onOid: (value: string) => void;
  onTid: (value: string) => void;
  onApiKey: (value: string) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 p-3">
      <h3 className="text-fluid-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-fluid-2xs text-slate-500">{hint}</p>
      <div className="mt-3 grid gap-3">
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">MID</span>
          <input className={INPUT} value={mid} onChange={(e) => onMid(e.target.value)} autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">주문번호 4자리</span>
          <input className={INPUT} value={oid} onChange={(e) => onOid(e.target.value.toUpperCase())} autoComplete="off" maxLength={4} />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">TID</span>
          <input className={INPUT} value={tid} onChange={(e) => onTid(e.target.value)} autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">API 키</span>
          <input className={INPUT} value={apiKey} onChange={(e) => onApiKey(e.target.value)} autoComplete="off" />
        </label>
      </div>
    </section>
  );
}

export function PgPartnerConnectPanel({ onboardingId, onSaved }: { onboardingId: string; onSaved: () => void }) {
  const navigate = useNavigate();
  const [sellerLoginId, setSellerLoginId] = useState('');
  const [sellerPassword, setSellerPassword] = useState('');
  const [keyinMid, setKeyinMid] = useState('');
  const [keyinOid, setKeyinOid] = useState('');
  const [keyinTid, setKeyinTid] = useState('');
  const [keyinKey, setKeyinKey] = useState('');
  const [linkMid, setLinkMid] = useState('');
  const [linkOid, setLinkOid] = useState('');
  const [linkTid, setLinkTid] = useState('');
  const [linkKey, setLinkKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const ready = [sellerLoginId, sellerPassword, keyinMid, keyinOid, keyinTid, keyinKey, linkMid, linkOid, linkTid, linkKey].every((value) => value.trim());

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        void fetch(`/api/public/card-payment/pg-partner/applications/${encodeURIComponent(onboardingId)}/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${readPgPartnerToken()}` },
          body: JSON.stringify({
            sellerLoginId,
            sellerPassword,
            keyin: { mid: keyinMid, oid: keyinOid, tid: keyinTid, apiKey: keyinKey },
            link: { mid: linkMid, oid: linkOid, tid: linkTid, apiKey: linkKey },
          }),
        })
          .then(async (res) => {
            const body = (await res.json().catch(() => null)) as { error?: string } | null;
            if (res.status === 401) {
              clearPgPartnerToken();
              navigate('/pg-partner', { replace: true });
              return;
            }
            if (!res.ok) throw new Error(body?.error || '연동하지 못했습니다.');
            setDone('연동했습니다. 이 업체 팀장이 카드결재를 쓸 수 있습니다.');
            onSaved();
          })
          .catch((err: unknown) => setError(err instanceof Error ? err.message : '연동하지 못했습니다.'))
          .finally(() => setBusy(false));
      }}
    >
      <p className="text-fluid-2xs text-slate-500">전자계약이 들어온 뒤에 수기와 인증 코드를 넣으면 업체가 연결됩니다. 카드번호는 적지 않습니다.</p>
      <section className="rounded-xl border border-slate-200 p-3">
        <h3 className="text-fluid-sm font-semibold text-slate-900">판매자센터</h3>
        <p className="mt-1 text-fluid-2xs text-slate-500">수기와 인증이 같은 아이디를 씁니다. https://wspay.net</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-fluid-2xs text-slate-500">아이디</span>
            <input className={INPUT} value={sellerLoginId} onChange={(e) => setSellerLoginId(e.target.value)} autoComplete="off" />
          </label>
          <label className="block">
            <span className="text-fluid-2xs text-slate-500">비밀번호</span>
            <input className={INPUT} type="password" value={sellerPassword} onChange={(e) => setSellerPassword(e.target.value)} autoComplete="new-password" />
          </label>
        </div>
      </section>
      <div className="grid gap-3 lg:grid-cols-2">
        <RailFields title="수기" hint="API 키는 ssp-로 시작합니다." mid={keyinMid} oid={keyinOid} tid={keyinTid} apiKey={keyinKey} onMid={setKeyinMid} onOid={setKeyinOid} onTid={setKeyinTid} onApiKey={setKeyinKey} />
        <RailFields title="인증" hint="API 키는 결제창 mKey입니다." mid={linkMid} oid={linkOid} tid={linkTid} apiKey={linkKey} onMid={setLinkMid} onOid={setLinkOid} onTid={setLinkTid} onApiKey={setLinkKey} />
      </div>
      {done ? <p className="text-fluid-xs font-medium text-emerald-800">{done}</p> : null}
      {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
      <button type="submit" className={BTN} disabled={busy || !ready}>
        {busy ? '연동 중' : '연동하기'}
      </button>
    </form>
  );
}
