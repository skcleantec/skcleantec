import { useEffect, useState } from 'react';
import { fetchBankDepositSettings, saveBankDepositSettings, type BankDepositSettings } from '../../api/bankDeposits';
import { Button } from '../ui/Button';
import { OnOffSwitch } from '../ui/OnOffSwitch';

const INTERVALS = [10, 20, 30, 60];
const HOURS = Array.from({ length: 25 }, (_, i) => i);

function wonInput(n: number): string {
  return n > 0 ? n.toLocaleString('ko-KR') : '';
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-fluid-xs font-semibold text-slate-900">{title}</p>
        {hint ? <p className="mt-0.5 text-fluid-2xs leading-relaxed text-slate-500">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** 폰·통장·알림 설정 창의 「알림 설정」 — 팀장에게 무엇을 얼마나 자주 알릴지. */
export function BankDepositAlertSettings({ token, onSaved }: { token: string; onSaved?: () => void }) {
  const [saved, setSaved] = useState<BankDepositSettings | null>(null);
  const [form, setForm] = useState<BankDepositSettings | null>(null);
  const [minAmount, setMinAmount] = useState('');
  const [depositList, setDepositList] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchBankDepositSettings(token)
      .then((r) => {
        if (cancelled) return;
        setSaved(r.settings);
        setForm(r.settings);
        setMinAmount(wonInput(r.settings.teamAlertMinAmountWon));
        setDepositList(r.settings.depositAmountsWon.map((n) => n.toLocaleString('ko-KR')).join(', '));
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (unavailable) return null;
  if (!form) return <p className="py-3 text-center text-fluid-2xs text-slate-500">알림 설정을 불러오는 중이에요.</p>;

  const set = <K extends keyof BankDepositSettings>(key: K, value: BankDepositSettings[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDone(false);
  };

  const parsedDeposits = depositList
    .split(/[,\s]+/)
    .map((x) => Number(x.replace(/[^\d]/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  const next: BankDepositSettings = {
    ...form,
    teamAlertMinAmountWon: Number(minAmount.replace(/[^\d]/g, '')) || 0,
    depositAmountsWon: parsedDeposits,
  };
  const dirty = JSON.stringify(next) !== JSON.stringify(saved);
  const hoursBad = next.teamAlertStartHour >= next.teamAlertEndHour;
  const depositsBad = next.depositAmountsMode === 'manual' && parsedDeposits.length === 0;

  const save = async () => {
    if (busy || hoursBad || depositsBad) return;
    setBusy(true);
    setError(null);
    try {
      const r = await saveBankDepositSettings(token, next);
      setSaved(r.settings);
      setForm(r.settings);
      setMinAmount(wonInput(r.settings.teamAlertMinAmountWon));
      setDepositList(r.settings.depositAmountsWon.map((n) => n.toLocaleString('ko-KR')).join(', '));
      setDone(true);
      window.dispatchEvent(new Event('cbiseo:bank-deposit-settings'));
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const select = 'h-8 rounded-lg border border-slate-300 bg-white px-2 text-fluid-xs text-slate-900';
  const teamOff = !form.teamOpenAlertEnabled;

  return (
    <section>
      <p className="text-fluid-xs font-bold text-slate-900">알림 설정</p>
      <div className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">
        <Row title="잔금이 들어오면 담당 팀장에게 알리기" hint="배정된 팀장의 휴대폰 알림과 앱 화면 팝업으로 알려요.">
          <OnOffSwitch
            checked={form.teamBalanceAlertEnabled}
            onChange={(v: boolean) => set('teamBalanceAlertEnabled', v)}
            title="잔금 입금 알림"
          />
        </Row>
        <Row title="주인을 못 찾은 입금을 모든 팀장에게 묻기" hint="끄면 사무실 화면에만 「확인 필요」로 남고 팀장에게는 가지 않아요.">
          <OnOffSwitch
            checked={form.teamOpenAlertEnabled}
            onChange={(v: boolean) => set('teamOpenAlertEnabled', v)}
            title="주인 없는 입금 알림"
          />
        </Row>
        <div className={teamOff ? 'pointer-events-none opacity-45' : ''} aria-disabled={teamOff}>
          <Row title="이 금액 미만은 팀장에게 묻지 않기" hint="10원 같은 시험 입금이나 소액은 사무실에서만 봅니다. 0이면 금액 제한 없음.">
            <span className="inline-flex items-center gap-1">
              <input
                value={minAmount}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^\d]/g, '');
                  setMinAmount(digits ? Number(digits).toLocaleString('ko-KR') : '');
                  setDone(false);
                }}
                inputMode="numeric"
                placeholder="0"
                aria-label="팀장 알림 최소 금액"
                className="h-8 w-28 rounded-lg border border-slate-300 px-2 text-right text-fluid-xs tabular-nums text-slate-900"
              />
              <span className="text-fluid-2xs text-slate-600">원</span>
            </span>
          </Row>
          <Row title="다시 알리는 간격" hint="누군가 확인하거나 사무실에서 처리할 때까지 반복해요.">
            <select
              value={form.teamReminderIntervalMin}
              onChange={(e) => set('teamReminderIntervalMin', Number(e.target.value))}
              aria-label="다시 알리는 간격"
              className={select}
            >
              {INTERVALS.map((m) => (
                <option key={m} value={m}>
                  {m}분마다
                </option>
              ))}
            </select>
          </Row>
          <Row title="알림 보내는 시간" hint="이 시간 밖에 들어온 입금은 다음 날 시작 시각부터 알려요.">
            <span className="inline-flex items-center gap-1">
              <select
                value={form.teamAlertStartHour}
                onChange={(e) => set('teamAlertStartHour', Number(e.target.value))}
                aria-label="알림 시작 시각"
                className={select}
              >
                {HOURS.slice(0, 24).map((h) => (
                  <option key={h} value={h}>
                    {h}시
                  </option>
                ))}
              </select>
              <span className="text-fluid-2xs text-slate-500">~</span>
              <select
                value={form.teamAlertEndHour}
                onChange={(e) => set('teamAlertEndHour', Number(e.target.value))}
                aria-label="알림 끝 시각"
                className={select}
              >
                {HOURS.slice(1).map((h) => (
                  <option key={h} value={h}>
                    {h}시
                  </option>
                ))}
              </select>
            </span>
          </Row>
          <Row title="언제까지 다시 알릴지" hint="이 시간이 지나도 주인이 없으면 팀장 알림은 멈추고 사무실 화면에만 남아요.">
            <select
              value={form.teamReminderMaxHours}
              onChange={(e) => set('teamReminderMaxHours', Number(e.target.value))}
              aria-label="다시 알리는 기간"
              className={select}
            >
              {[3, 6, 12, 24, 48].map((h) => (
                <option key={h} value={h}>
                  입금 뒤 {h}시간
                </option>
              ))}
            </select>
          </Row>
        </div>
        <Row
          title="계약금으로 보는 금액"
          hint="이 금액의 입금은 계약금으로 보고 팀장에게 묻지 않아요. 자동은 최근 접수들의 계약금 값을 씁니다."
        >
          <span className="flex flex-col items-end gap-1">
            <select
              value={form.depositAmountsMode}
              onChange={(e) => set('depositAmountsMode', e.target.value === 'manual' ? 'manual' : 'auto')}
              aria-label="계약금 금액 정하는 방법"
              className={select}
            >
              <option value="auto">자동</option>
              <option value="manual">직접 정하기</option>
            </select>
            {form.depositAmountsMode === 'manual' ? (
              <input
                value={depositList}
                onChange={(e) => {
                  setDepositList(e.target.value);
                  setDone(false);
                }}
                placeholder="20,000, 30,000"
                aria-label="계약금 금액 목록"
                className="h-8 w-40 rounded-lg border border-slate-300 px-2 text-right text-fluid-xs tabular-nums text-slate-900"
              />
            ) : null}
          </span>
        </Row>
        <Row title="사무실 화면 알림" hint="관리자·마케터 화면 오른쪽 아래에 「입금이 들어왔어요」를 띄워요.">
          <OnOffSwitch checked={form.staffToastEnabled} onChange={(v: boolean) => set('staffToastEnabled', v)} title="사무실 화면 알림" />
        </Row>
      </div>
      {hoursBad ? <p className="mt-1.5 text-fluid-2xs text-rose-700">알림 끝 시각이 시작 시각보다 늦어야 해요.</p> : null}
      {depositsBad ? <p className="mt-1.5 text-fluid-2xs text-rose-700">계약금 금액을 하나 이상 적어 주세요.</p> : null}
      {error ? <p className="mt-1.5 text-fluid-2xs text-rose-700">{error}</p> : null}
      <div className="mt-2 flex items-center justify-end gap-2">
        {done && !dirty ? <span className="text-fluid-2xs font-semibold text-emerald-700">저장했어요</span> : null}
        <Button size="md" variant="primary" disabled={!dirty || busy || hoursBad || depositsBad} onClick={() => void save()}>
          {busy ? '저장하는 중' : '알림 설정 저장'}
        </Button>
      </div>
    </section>
  );
}
