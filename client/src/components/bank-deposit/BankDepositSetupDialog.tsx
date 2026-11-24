import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createBankDepositAccount,
  createBankDepositLinkCode,
  deleteBankDepositAccount,
  listBankDepositAccounts,
  listBankDepositDevices,
  requestBankDepositRescan,
  revokeBankDepositDevice,
  type BankDepositAccountItem,
  type BankDepositDeviceItem,
} from '../../api/bankDeposits';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import { Button } from '../ui/Button';
import { deviceSeen } from './bankDepositFormat';

type Brand = { id: string; name: string };

function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** 관리자 — 입금 문자를 받는 폰과 통장을 정한다. 자주 쓰지 않아 창으로 둔다. */
export function BankDepositSetupDialog({
  token,
  brands,
  onClose,
  onChanged,
}: {
  token: string;
  brands: Brand[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [devices, setDevices] = useState<BankDepositDeviceItem[]>([]);
  const [accounts, setAccounts] = useState<BankDepositAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [armedDeviceId, setArmedDeviceId] = useState<string | null>(null);
  const [rescanAsked, setRescanAsked] = useState<Record<string, boolean>>({});
  const [armedAccountId, setArmedAccountId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '');
  const [bankName, setBankName] = useState('농협');
  const [accountMask, setAccountMask] = useState('');
  const [adding, setAdding] = useState(false);
  const now = useNow(1000);

  const load = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([listBankDepositDevices(token), listBankDepositAccounts(token)]);
      setDevices(d.items);
      setAccounts(a.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '설정을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!brandId && brands[0]) setBrandId(brands[0].id);
  }, [brands, brandId]);

  // 코드를 띄워 둔 동안 폰이 연결됐는지 5초마다 본다.
  useEffect(() => {
    if (!code) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [code, load]);

  const codeLeftSec = code ? Math.max(0, Math.floor((new Date(code.expiresAt).getTime() - now) / 1000)) : 0;
  const activeDevices = devices.filter((d) => d.isActive && !d.revokedAt);
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? '브랜드';

  const makeCode = async () => {
    setCodeBusy(true);
    setError(null);
    try {
      setCode(await createBankDepositLinkCode(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : '연결 코드를 만들지 못했어요.');
    } finally {
      setCodeBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setError(null);
    try {
      await revokeBankDepositDevice(token, id);
      setArmedDeviceId(null);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '연결을 끊지 못했어요.');
    }
  };

  const addAccount = async () => {
    const mask = accountMask.trim();
    if (!brandId || !mask || adding) return;
    setAdding(true);
    setError(null);
    try {
      await createBankDepositAccount(token, { operatingCompanyId: brandId, bankName: bankName.trim() || '농협', accountMask: mask });
      setAccountMask('');
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '통장을 등록하지 못했어요.');
    } finally {
      setAdding(false);
    }
  };

  const removeAccount = async (id: string) => {
    setError(null);
    try {
      await deleteBankDepositAccount(token, id);
      setArmedAccountId(null);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '통장을 지우지 못했어요.');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="입금 확인 설정">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-900/40" />
      <div className="relative flex max-h-[86vh] w-[min(560px,100%)] flex-col rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-4 py-3 pr-14">
          <p className="text-fluid-sm font-bold text-slate-900">폰·통장 설정</p>
          <p className="mt-0.5 text-fluid-2xs leading-relaxed text-slate-600">
            은행 입금 문자를 받는 폰에 「청소비서 입금 알림」 앱을 깔고 여기서 연결합니다.
          </p>
          <ModalCloseButton onClick={onClose} />
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {loading ? <p className="py-6 text-center text-fluid-xs text-slate-500">불러오는 중이에요.</p> : null}

          {!loading ? (
            <section>
              <p className="text-fluid-xs font-bold text-slate-900">입금 문자를 받는 폰</p>
              {activeDevices.length === 0 ? (
                <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-fluid-2xs leading-relaxed text-slate-600">
                  아직 연결된 폰이 없어요. 아래에서 연결 코드를 만들어 폰 앱에 입력하세요.
                </p>
              ) : (
                <ul className="mt-1.5 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {activeDevices.map((d) => {
                    const seen = deviceSeen(d.lastSeenAt, now);
                    return (
                      <li key={d.id} className="flex items-center gap-2 px-3 py-2">
                        <span className={`size-2 shrink-0 rounded-full ${seen.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-fluid-xs font-semibold text-slate-900">{d.name}</span>
                          <span className={`block text-fluid-2xs ${seen.ok ? 'text-slate-500' : 'text-rose-700'}`}>
                            마지막 연결 {seen.text}
                            {seen.ok ? '' : ' · 폰이 꺼졌거나 앱이 멈췄을 수 있어요'}
                          </span>
                          <span className="block text-fluid-2xs text-slate-500">
                            {d.lastScanAt
                              ? `문자함 점검 ${deviceSeen(d.lastScanAt, now).text} · 새로 찾은 입금 ${d.lastScanFound ?? 0}건`
                              : '문자함 점검 기록 없음'}
                            {rescanAsked[d.id] ? ' · 다시 확인을 요청했어요(다음 연결 때 실행)' : ''}
                          </span>
                        </span>
                        {armedDeviceId === d.id ? (
                          <span className="flex shrink-0 gap-1">
                            <Button size="sm" variant="danger" onClick={() => void revoke(d.id)}>
                              끊기
                            </Button>
                            <Button size="sm" variant="quiet" onClick={() => setArmedDeviceId(null)}>
                              취소
                            </Button>
                          </span>
                        ) : (
                          <span className="flex shrink-0 gap-1">
                            <Button
                              size="sm"
                              title="폰이 최근 이틀 문자함을 다시 훑어, 빠진 입금 문자가 있으면 가져옵니다"
                              disabled={Boolean(rescanAsked[d.id])}
                              onClick={() =>
                                void requestBankDepositRescan(token, d.id)
                                  .then(() => setRescanAsked((prev) => ({ ...prev, [d.id]: true })))
                                  .catch((e) => setError(e instanceof Error ? e.message : '요청하지 못했어요.'))
                              }
                            >
                              빠진 문자 다시 확인
                            </Button>
                            <Button size="sm" variant="quiet" onClick={() => setArmedDeviceId(d.id)}>
                              연결 끊기
                            </Button>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {code && codeLeftSec > 0 ? (
                <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-3 text-center">
                  <p className="text-fluid-2xs text-violet-900">폰 앱의 첫 화면에 이 숫자를 입력하세요</p>
                  <p className="mt-1 text-[30px] font-extrabold leading-none tracking-[0.18em] tabular-nums text-violet-900">
                    {code.code.slice(0, 3)} {code.code.slice(3)}
                  </p>
                  <p className="mt-1.5 text-fluid-2xs tabular-nums text-violet-800">
                    {Math.floor(codeLeftSec / 60)}분 {String(codeLeftSec % 60).padStart(2, '0')}초 남음 · 한 번만 쓸 수 있어요
                  </p>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <Button size="md" onClick={() => void makeCode()} disabled={codeBusy}>
                    {codeBusy ? '만드는 중' : code ? '연결 코드 다시 만들기' : '연결 코드 만들기'}
                  </Button>
                  {code ? <span className="text-fluid-2xs text-slate-500">앞의 코드는 시간이 지났어요.</span> : null}
                </div>
              )}
            </section>
          ) : null}

          {!loading ? (
            <section>
              <p className="text-fluid-xs font-bold text-slate-900">입금 받는 통장</p>
              <p className="mt-0.5 text-fluid-2xs leading-relaxed text-slate-600">
                통장을 등록해야 그 통장으로 들어온 입금을 브랜드의 접수와 자동으로 맞춥니다. 등록하지 않은 통장의 입금은 모두 「확인 필요」로 남아요. 계좌는 입금 문자에 보이는 그대로(별표 포함) 적어 주세요.
              </p>
              {accounts.length > 0 ? (
                <ul className="mt-1.5 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {accounts.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-fluid-xs font-semibold tabular-nums text-slate-900">
                          {a.bankName} {a.accountMask}
                        </span>
                        <span className="block text-fluid-2xs text-slate-500">{brandName(a.operatingCompanyId)}</span>
                      </span>
                      {armedAccountId === a.id ? (
                        <span className="flex shrink-0 gap-1">
                          <Button size="sm" variant="danger" onClick={() => void removeAccount(a.id)}>
                            지우기
                          </Button>
                          <Button size="sm" variant="quiet" onClick={() => setArmedAccountId(null)}>
                            취소
                          </Button>
                        </span>
                      ) : (
                        <Button size="sm" variant="quiet" onClick={() => setArmedAccountId(a.id)}>
                          지우기
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[120px_88px_1fr_auto]">
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  aria-label="브랜드"
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-fluid-xs text-slate-900"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  aria-label="은행"
                  placeholder="은행"
                  className="h-9 rounded-lg border border-slate-300 px-2.5 text-fluid-xs text-slate-900"
                />
                <input
                  value={accountMask}
                  onChange={(e) => setAccountMask(e.target.value)}
                  aria-label="문자에 보이는 계좌"
                  placeholder="000-****-0000-00"
                  className="h-9 min-w-0 rounded-lg border border-slate-300 px-2.5 text-fluid-xs tabular-nums text-slate-900 placeholder:text-slate-400"
                />
                <Button size="md" onClick={() => void addAccount()} disabled={!brandId || !accountMask.trim() || adding}>
                  {adding ? '등록 중' : '통장 등록'}
                </Button>
              </div>
            </section>
          ) : null}

          {error ? <p className="text-fluid-2xs text-rose-700">{error}</p> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
