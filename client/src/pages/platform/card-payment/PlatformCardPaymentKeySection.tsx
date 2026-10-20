import { useEffect, useState } from 'react';
import { listPlatformTenants, type PlatformTenantRow } from '../../../api/platformTenants';
import {
  fetchPlatformTenantCredential,
  probePlatformTenantPayment,
  savePlatformPgCredential,
  type PlatformCredentialSlot,
} from '../../../api/platformCardPayment';
import { getPlatformToken } from '../../../stores/platformAuth';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_BASE } from '../../../utils/platformUi';

const BTN =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none';

function slotSummary(label: string, row: PlatformCredentialSlot | undefined) {
  if (!row?.connected) return `${label} · 아직 없음`;
  const bits = [
    row.mid ? `MID ${row.mid}` : null,
    row.oid ? `OID ${row.oid}` : null,
    row.tidMasked ? `TID ${row.tidMasked}` : null,
    row.apiKeyLast4 ? `키 끝 ${row.apiKeyLast4}` : null,
  ].filter(Boolean);
  return `${label} · ${bits.join(' · ')}`;
}

export function PlatformCardPaymentKeySection() {
  const [tenants, setTenants] = useState<PlatformTenantRow[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [saved, setSaved] = useState<{ keyin: PlatformCredentialSlot; link: PlatformCredentialSlot } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [probeMessage, setProbeMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = getPlatformToken();
    if (!token) return;
    void listPlatformTenants(token)
      .then(setTenants)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '업체 목록을 불러오지 못했습니다.'));
  }, []);

  useEffect(() => {
    if (!tenantId) {
      setSaved(null);
      return;
    }
    void fetchPlatformTenantCredential(tenantId)
      .then(setSaved)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '저장된 키를 불러오지 못했습니다.'));
  }, [tenantId]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        수기(현장 카드)와 링크(고객 결제창)는 가맹 키가 다릅니다. 둘 다 저장해야 그 업체 팀장 화면에서 각각 쓸 수 있습니다. 전체 키는 다시 보여 주지 않고, MID·OID·TID·키 끝만 확인합니다. 서비스브릿지 이용료 키는 여기 넣지 않습니다.
      </p>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <label className="block text-sm text-gray-600">
        업체
        <select
          className={`${INPUT_BASE} mt-1`}
          value={tenantId}
          onChange={(e) => {
            setTenantId(e.target.value);
            setProbeMessage(null);
          }}
        >
          <option value="">업체를 선택하세요</option>
          {tenants.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name} ({row.slug})
            </option>
          ))}
        </select>
      </label>
      {saved ? (
        <div className="space-y-1 text-sm text-gray-800">
          <p>{slotSummary('수기', saved.keyin)}</p>
          <p>{slotSummary('링크', saved.link)}</p>
        </div>
      ) : null}
      <RailForm
        title="수기 (구인증)"
        rail="KEYIN"
        needTid
        tenantId={tenantId}
        busy={busy}
        setBusy={setBusy}
        onError={setError}
        onSaved={setSaved}
        onProbe={setProbeMessage}
      />
      <RailForm
        title="링크 (인증결제)"
        rail="LINK"
        needTid={false}
        tenantId={tenantId}
        busy={busy}
        setBusy={setBusy}
        onError={setError}
        onSaved={setSaved}
        onProbe={setProbeMessage}
      />
      {probeMessage ? <p className="text-sm text-gray-800">{probeMessage}</p> : null}
    </div>
  );
}

function RailForm(props: {
  title: string;
  rail: 'KEYIN' | 'LINK';
  needTid: boolean;
  tenantId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onError: (v: string | null) => void;
  onSaved: (v: { keyin: PlatformCredentialSlot; link: PlatformCredentialSlot }) => void;
  onProbe: (v: string | null) => void;
}) {
  const [mid, setMid] = useState('');
  const [oid, setOid] = useState('');
  const [tid, setTid] = useState('');
  const [apiKey, setApiKey] = useState('');

  return (
    <div className="space-y-2 rounded-xl border border-gray-200 p-3">
      <p className="text-sm font-medium text-gray-900">{props.title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={INPUT_BASE} placeholder="MID" value={mid} onChange={(e) => setMid(e.target.value)} />
        <input className={INPUT_BASE} placeholder="OID (4자리)" value={oid} onChange={(e) => setOid(e.target.value)} />
        {props.needTid ? (
          <input className={INPUT_BASE} placeholder="X-TID" value={tid} onChange={(e) => setTid(e.target.value)} />
        ) : null}
        <input
          className={INPUT_BASE}
          placeholder={props.rail === 'KEYIN' ? 'API 키 (ssp-)' : 'mKey'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={props.busy || !props.tenantId}
          className={`${BTN_PRIMARY} ${BTN}`}
          onClick={() => {
            props.setBusy(true);
            props.onError(null);
            void savePlatformPgCredential(props.tenantId, {
              rail: props.rail,
              apiKey,
              tid: props.needTid ? tid : '',
              mid,
              oid,
            })
              .then(() => {
                setApiKey('');
                setTid('');
                setMid('');
                setOid('');
                return fetchPlatformTenantCredential(props.tenantId);
              })
              .then(props.onSaved)
              .catch((e: unknown) => props.onError(e instanceof Error ? e.message : '키 저장 실패'))
              .finally(() => props.setBusy(false));
          }}
        >
          {props.title} 저장
        </button>
        <button
          type="button"
          disabled={props.busy || !props.tenantId}
          className={`${BTN_SECONDARY} ${BTN}`}
          onClick={() => {
            props.setBusy(true);
            props.onError(null);
            void probePlatformTenantPayment(props.tenantId, props.rail)
              .then((result) => props.onProbe(result.message))
              .catch((e: unknown) => props.onError(e instanceof Error ? e.message : '연결 테스트 실패'))
              .finally(() => props.setBusy(false));
          }}
        >
          연결 테스트
        </button>
      </div>
    </div>
  );
}
