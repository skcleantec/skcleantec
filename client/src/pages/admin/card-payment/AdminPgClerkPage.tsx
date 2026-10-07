import { useEffect, useRef, useState } from 'react';
import { FeatureGate } from '../../../components/auth/FeatureGate';
import { PageTitleWithFavorite } from '../../../components/layout/NavFavoritePageTitle';
import { fetchPgClerkSlots, savePgClerkSlots, type PgClerkSlot } from '../../../api/cardPayment';
import { getToken } from '../../../stores/auth';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';

const SELECT =
  'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-fluid-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

function AdminPgClerkInner() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true);
  const [slots, setSlots] = useState<PgClerkSlot[]>([]);
  const [leaders, setLeaders] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    void fetchPgClerkSlots(token)
      .then((res) => {
        setSlots(res.slots);
        setLeaders(res.leaders);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'));
  }, []);

  const taken = new Set(slots.map((slot) => slot.user?.id).filter((id): id is string => Boolean(id)));

  return (
    <div className="min-w-0 w-full max-w-3xl space-y-3 pb-8">
      <div>
        <PageTitleWithFavorite label="원성번호">
          <h1 className="text-xl font-semibold text-gray-800">원성번호</h1>
        </PageTitleWithFavorite>
        <p className="mt-1 text-sm text-gray-500">
          원성이 부여한 1번부터 15번을 팀장에게 매칭합니다. 퇴사자가 생기면 그 번호를 다른 팀장으로 바꾸면, 이후 그 팀장의 카드 결제가 그 번호로 구분됩니다.
        </p>
      </div>
      <div
        ref={scrollRef}
        onFocusCapture={onFieldFocus}
        className="modal-form-scroll-surface space-y-2 rounded-xl border border-slate-200 bg-white p-2 sm:p-4"
      >
        {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
        {saved ? <p className="text-fluid-xs text-emerald-800">매칭을 저장했습니다.</p> : null}
        {slots.length === 0 && !error ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}
        {slots.map((slot) => (
          <label key={slot.clerkNo} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
            <span className="text-fluid-xs font-medium tabular-nums text-slate-800">{slot.clerkNo}번</span>
            <select
              className={SELECT}
              value={slot.user?.id ?? ''}
              onChange={(e) => {
                const userId = e.target.value;
                setSaved(false);
                setSlots((prev) =>
                  prev.map((row) => {
                    if (row.clerkNo !== slot.clerkNo) {
                      if (userId && row.user?.id === userId) return { ...row, user: null };
                      return row;
                    }
                    if (!userId) return { ...row, user: null };
                    const leader = leaders.find((item) => item.id === userId);
                    const keep = slot.user?.id === userId ? slot.user : null;
                    return {
                      ...row,
                      user: leader ? { id: leader.id, name: leader.name, resigned: false } : keep,
                    };
                  }),
                );
              }}
            >
              <option value="">비움</option>
              {slot.user?.resigned ? (
                <option value={slot.user.id}>{slot.user.name} (퇴사)</option>
              ) : null}
              {leaders
                .filter((leader) => leader.id === slot.user?.id || !taken.has(leader.id))
                .map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.name}
                  </option>
                ))}
            </select>
          </label>
        ))}
        <button
          type="button"
          disabled={saving || slots.length === 0}
          className="mt-2 min-h-10 rounded-lg bg-slate-900 px-4 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          onClick={() => {
            const token = getToken();
            if (!token) return;
            setSaving(true);
            setError(null);
            void savePgClerkSlots(
              token,
              slots.map((slot) => ({ clerkNo: slot.clerkNo, userId: slot.user?.id ?? null })),
            )
              .then((res) => {
                setSlots(res.slots);
                setLeaders(res.leaders);
                setSaved(true);
              })
              .catch((e: unknown) => setError(e instanceof Error ? e.message : '저장하지 못했습니다.'))
              .finally(() => setSaving(false));
          }}
        >
          {saving ? '저장 중' : '매칭 저장'}
        </button>
      </div>
    </div>
  );
}

export function AdminPgClerkPage() {
  return (
    <FeatureGate module="mod_card_payment">
      <AdminPgClerkInner />
    </FeatureGate>
  );
}
