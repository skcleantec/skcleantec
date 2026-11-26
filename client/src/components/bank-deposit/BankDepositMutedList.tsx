import { useCallback, useEffect, useState } from 'react';
import {
  deleteBankDepositMuted,
  listBankDepositMuted,
  updateBankDepositMuted,
  type BankDepositMutedItem,
} from '../../api/bankDeposits';
import { Button } from '../ui/Button';
import { OnOffSwitch } from '../ui/OnOffSwitch';
import { RowActions } from '../ui/RowActions';
import { confirmDialog, toast } from '../ui/Toast';
import { BankDepositMuteDialog, MUTED_KIND_LABEL } from './BankDepositMuteDialog';

const KIND_DOT: Record<string, string> = { PG: 'bg-blue-700 text-blue-700', PARTNER: 'bg-emerald-700 text-emerald-700', OTHER: 'bg-slate-500 text-slate-600' };

function mmdd(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`;
}

/** 설정 창 「고정 입금처」 탭 — 목록·토글·수정·삭제 (시안: 한 줄 32px) */
export function BankDepositMutedList({
  token,
  brands,
  canManage,
  onChanged,
}: {
  token: string;
  brands: { id: string; name: string }[];
  /** 관리자만 수정·삭제 */
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<BankDepositMutedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BankDepositMutedItem | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await listBankDepositMuted(token);
      setItems(r.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (item: BankDepositMutedItem, enabled: boolean) => {
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, enabled } : x)));
    try {
      await updateBankDepositMuted(token, item.id, { enabled });
      onChanged?.();
    } catch (e) {
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, enabled: !enabled } : x)));
      toast.error(e instanceof Error ? e.message : '바꾸지 못했어요.');
    }
  };

  const remove = async (item: BankDepositMutedItem) => {
    const ok = await confirmDialog({
      title: `「${item.displayName}」을 목록에서 지울까요?`,
      body: '지우면 다음 입금부터 다시 보통 입금처럼 알립니다. 이미 쌓인 입금내역은 그대로 남아요.',
      confirmLabel: '지우기',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteBankDepositMuted(token, item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '지우지 못했어요.');
    }
  };

  const grid = 'grid grid-cols-[1.4fr_1fr_72px_64px_1fr_36px_24px] items-center gap-2';

  return (
    <section>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-fluid-xs font-bold text-slate-900">고정 입금처</p>
          <p className="mt-0.5 text-fluid-2xs leading-relaxed text-slate-500">
            PG사·협력업체처럼 늘 들어오는 입금자예요. 여기 있으면 알림 없이 입금내역에 「고정 입금처」로 조용히 쌓입니다.
          </p>
        </div>
        <Button size="sm" variant="primary" onClick={() => setAdding(true)} nowrap>
          + 추가
        </Button>
      </div>

      {loading ? <p className="py-4 text-center text-fluid-2xs text-slate-500">불러오는 중이에요.</p> : null}
      {error ? <p className="mt-2 text-fluid-2xs text-rose-700">{error}</p> : null}

      {!loading && items.length === 0 ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-fluid-2xs leading-relaxed text-slate-600">
          아직 등록된 고정 입금처가 없어요. 입금내역에서 PG사·협력업체 입금 줄의 「고정 입금처」를 누르거나, 위 「+ 추가」로 넣으세요.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-3">
          <div className={`${grid} px-2.5 text-fluid-2xs text-slate-500`}>
            <span>표시명</span>
            <span>입금자명</span>
            <span>브랜드</span>
            <span>구분</span>
            <span>최근 · 누적</span>
            <span>알림</span>
            <span />
          </div>
          <ul className="mt-1.5 flex flex-col gap-1">
            {items.map((item) => {
              const dot = KIND_DOT[item.kind] ?? KIND_DOT.OTHER;
              return (
                <li key={item.id} className={`${grid} h-8 rounded-lg bg-slate-50 px-2.5 ${item.enabled ? '' : 'opacity-60'}`}>
                  <span className="truncate text-fluid-xs font-semibold text-slate-900" title={item.memo ?? undefined}>
                    {item.displayName}
                  </span>
                  <span className="truncate text-fluid-2xs text-slate-500">
                    {item.depositorName}
                    {item.matchMode === 'prefix' ? ' · 뒷자리 무시' : ''}
                  </span>
                  <span className="truncate text-fluid-2xs text-slate-600">{item.operatingCompanyName ?? '모든 브랜드'}</span>
                  <span className={`inline-flex items-center gap-1.5 text-fluid-2xs ${dot.split(' ')[1]}`}>
                    <span className={`size-1.5 rounded-full ${dot.split(' ')[0]}`} aria-hidden />
                    {MUTED_KIND_LABEL[item.kind] ?? '기타'}
                  </span>
                  <span className="whitespace-nowrap text-fluid-2xs text-slate-600">
                    {mmdd(item.lastMatchedAt)} · {item.matchCount}건
                  </span>
                  <OnOffSwitch
                    checked={item.enabled}
                    onChange={(next) => void toggle(item, next)}
                    showState={false}
                    disabled={!canManage}
                    title={item.enabled ? '알림 끔 (고정 입금처로 접는 중)' : '꺼짐 — 보통 입금처럼 알림'}
                  />
                  {canManage ? (
                    <RowActions
                      menu={[
                        { label: '수정', onSelect: () => setEditing(item) },
                        { label: '지우기', onSelect: () => void remove(item), danger: true },
                      ]}
                    />
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 text-fluid-2xs leading-relaxed text-slate-500">
        알림을 끄면 그 입금자는 울리지 않고, 켜면 다시 보통 입금처럼 알립니다. 기록은 입금내역 「청소와 무관」 필터에서 언제든 볼 수 있어요.
      </p>

      {adding ? (
        <BankDepositMuteDialog
          token={token}
          brands={brands}
          onClose={() => setAdding(false)}
          onSaved={(item) => {
            setAdding(false);
            setItems((prev) => [item, ...prev]);
            onChanged?.();
          }}
        />
      ) : null}
      {editing ? (
        <BankDepositMuteDialog
          token={token}
          brands={brands}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={(item) => {
            setEditing(null);
            setItems((prev) => prev.map((x) => (x.id === item.id ? item : x)));
            onChanged?.();
          }}
        />
      ) : null}
    </section>
  );
}
