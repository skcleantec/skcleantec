import { useEffect, useState } from 'react';
import { listBankDepositGuideAccounts, saveBankDepositGuideAccount } from '../../api/bankDeposits';
import { useOperatingCompanies } from '../../hooks/useOperatingCompanies';
import { useHasTenantFeature } from '../../hooks/useTenantCapabilities';
import { getToken } from '../../stores/auth';

type Row = { bankName: string; accountNumber: string; accountHolder: string };
const EMPTY: Row = { bankName: '', accountNumber: '', accountHolder: '' };

/**
 * 관리자 전용 › 사업자 정보 — 고객에게 안내할 입금 계좌.
 * 팀장이 「계좌입금」을 누르면 이 계좌가 보이고 복사할 수 있다. 「입금 확인」을 쓰는 업체에만 나온다.
 */
export function DepositGuideAccountCard() {
  const token = getToken();
  const featureOn = useHasTenantFeature('mod_bank_deposit');
  const brands = useOperatingCompanies(featureOn ? token : null).filter((b) => b.isActive);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [saved, setSaved] = useState<Record<string, Row>>({});
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!featureOn || !token) return;
    let cancelled = false;
    listBankDepositGuideAccounts(token)
      .then((r) => {
        if (cancelled) return;
        const map: Record<string, Row> = {};
        for (const it of r.items) {
          map[it.operatingCompanyId] = { bankName: it.bankName, accountNumber: it.accountNumber, accountHolder: it.accountHolder };
        }
        setRows(map);
        setSaved(map);
        setLoaded(true);
      })
      .catch(() => {
        /* 서버가 아직 모르면 이 칸을 숨긴다 */
      });
    return () => {
      cancelled = true;
    };
  }, [featureOn, token]);

  if (!featureOn || !token || !loaded || brands.length === 0) return null;

  const setField = (id: string, key: keyof Row, value: string) => {
    setRows((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY), [key]: value } }));
    setDoneId(null);
  };

  const save = async (id: string) => {
    const row = rows[id] ?? EMPTY;
    setBusyId(id);
    setError(null);
    try {
      const body = { bankName: row.bankName.trim(), accountNumber: row.accountNumber.trim(), accountHolder: row.accountHolder.trim() };
      await saveBankDepositGuideAccount(token, id, body);
      setSaved((prev) => ({ ...prev, [id]: body }));
      setRows((prev) => ({ ...prev, [id]: body }));
      setDoneId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setBusyId(null);
    }
  };

  const input = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm';

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-gray-900">입금 안내 계좌</h2>
      <p className="mt-1 text-sm leading-relaxed text-gray-600">
        고객이 잔금을 계좌로 보낼 때 안내하는 회사 계좌입니다. 팀장 앱의 「계좌입금」 창에 그대로 보이고, 팀장이 복사해서 고객에게 보낼 수 있어요.
      </p>
      <div className="mt-4 space-y-4">
        {brands.map((b) => {
          const row = rows[b.id] ?? EMPTY;
          const before = saved[b.id] ?? EMPTY;
          const dirty = row.bankName !== before.bankName || row.accountNumber !== before.accountNumber || row.accountHolder !== before.accountHolder;
          const partial = [row.bankName, row.accountNumber, row.accountHolder].some((x) => x.trim()) && ![row.bankName, row.accountNumber, row.accountHolder].every((x) => x.trim());
          return (
            <div key={b.id} className="rounded-lg border border-gray-100 bg-gray-50/80 p-4">
              <p className="text-sm font-semibold text-gray-900">{b.displayName || b.name}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-[140px_1fr_160px_auto] sm:items-end">
                <label className="block">
                  <span className="text-sm font-medium text-gray-800">은행</span>
                  <input value={row.bankName} onChange={(e) => setField(b.id, 'bankName', e.target.value)} className={input} placeholder="농협" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-800">계좌번호</span>
                  <input
                    value={row.accountNumber}
                    onChange={(e) => setField(b.id, 'accountNumber', e.target.value)}
                    className={`${input} tabular-nums`}
                    placeholder="000-0000-0000-00"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-800">예금주</span>
                  <input value={row.accountHolder} onChange={(e) => setField(b.id, 'accountHolder', e.target.value)} className={input} autoComplete="off" />
                </label>
                <button
                  type="button"
                  disabled={!dirty || partial || busyId === b.id}
                  onClick={() => void save(b.id)}
                  className="h-[38px] rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800 disabled:pointer-events-none disabled:opacity-50"
                >
                  {busyId === b.id ? '저장 중…' : '계좌 저장'}
                </button>
              </div>
              {partial ? <p className="mt-2 text-sm text-rose-700">은행·계좌번호·예금주를 모두 적거나 모두 비워 주세요.</p> : null}
              {doneId === b.id && !dirty ? <p className="mt-2 text-sm font-medium text-emerald-700">저장했어요.</p> : null}
            </div>
          );
        })}
      </div>
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </section>
  );
}
