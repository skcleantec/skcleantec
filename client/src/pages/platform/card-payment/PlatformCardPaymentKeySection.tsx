import { useEffect, useState } from 'react';
import { listPlatformTenants, type PlatformTenantRow } from '../../../api/platformTenants';
import {
  fetchPlatformTenantCredential,
  probePlatformTenantPayment,
  savePlatformPgCredential,
} from '../../../api/platformCardPayment';
import { getPlatformToken } from '../../../stores/platformAuth';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_BASE } from '../../../utils/platformUi';

const BTN =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none';

export function PlatformCardPaymentKeySection() {
  const [tenants, setTenants] = useState<PlatformTenantRow[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [tid, setTid] = useState('');
  const [mid, setMid] = useState('');
  const [oid, setOid] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [probeMessage, setProbeMessage] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      .then((row) => {
        if (!row.connected) {
          setSaved('이 업체에는 아직 결제 키가 없습니다.');
          return;
        }
        setSaved(
          `저장됨 · MID ${row.mid || '없음'} · OID ${row.oid || '없음'} · 키 끝 ${row.apiKeyLast4}`,
        );
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '저장된 키를 불러오지 못했습니다.'));
  }, [tenantId]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        업체가 PG 계약 후 받은 MID, TID, API 키, OID를 저장하면 그 업체 팀장 화면에서만 결제합니다. 서비스브릿지 이용료 키는 여기 넣지 않습니다.
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
            setRedirectUrl(null);
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
      {saved ? <p className="text-sm text-gray-700">{saved}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={INPUT_BASE} placeholder="MID" value={mid} onChange={(e) => setMid(e.target.value)} />
        <input className={INPUT_BASE} placeholder="OID (4자리)" value={oid} onChange={(e) => setOid(e.target.value)} />
        <input className={INPUT_BASE} placeholder="X-TID" value={tid} onChange={(e) => setTid(e.target.value)} />
        <input
          className={INPUT_BASE}
          placeholder="API 키 또는 mKey"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !tenantId}
          className={`${BTN_PRIMARY} ${BTN}`}
          onClick={() => {
            setBusy(true);
            setError(null);
            void savePlatformPgCredential(tenantId, { apiKey, tid, mid, oid })
              .then(() => {
                setApiKey('');
                setTid('');
                setMid('');
                setOid('');
                setProbeMessage(null);
                setRedirectUrl(null);
                return fetchPlatformTenantCredential(tenantId);
              })
              .then((row) => {
                if (row.connected) {
                  setSaved(`저장됨 · MID ${row.mid || '없음'} · OID ${row.oid || '없음'} · 키 끝 ${row.apiKeyLast4}`);
                }
              })
              .catch((e: unknown) => setError(e instanceof Error ? e.message : '키 저장 실패'))
              .finally(() => setBusy(false));
          }}
        >
          키 저장
        </button>
        <button
          type="button"
          disabled={busy || !tenantId}
          className={`${BTN_SECONDARY} ${BTN}`}
          onClick={() => {
            setBusy(true);
            setError(null);
            setRedirectUrl(null);
            void probePlatformTenantPayment(tenantId)
              .then((result) => {
                setProbeMessage(result.message);
                setRedirectUrl(result.rail === 'PAY_WINDOW' && result.ok ? result.redirectUrl || null : null);
              })
              .catch((e: unknown) => setError(e instanceof Error ? e.message : '연결 테스트 실패'))
              .finally(() => setBusy(false));
          }}
        >
          연결 테스트
        </button>
        {redirectUrl ? (
          <button
            type="button"
            className={`${BTN_SECONDARY} ${BTN}`}
            onClick={() => window.open(redirectUrl, '_blank', 'noopener,noreferrer')}
          >
            결제창 열어보기
          </button>
        ) : null}
      </div>
      {probeMessage ? <p className="text-sm text-gray-800">{probeMessage}</p> : null}
    </div>
  );
}
