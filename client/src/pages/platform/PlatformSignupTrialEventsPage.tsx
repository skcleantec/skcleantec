import { useCallback, useEffect, useState } from 'react';
import {
  createPlatformSignupTrialEvent,
  deletePlatformSignupTrialEvent,
  listPlatformSignupTrialEvents,
  updatePlatformSignupTrialEvent,
  type PlatformSignupTrialEvent,
} from '../../api/platformSignupTrialEvents';
import { getPlatformToken } from '../../stores/platformAuth';
import {
  BTN_DANGER,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD_SECTION,
  INPUT_BASE,
  PlatformAlert,
} from '../../utils/platformUi';

type FormState = {
  name: string;
  isActive: boolean;
  trialDays: number;
  startsAt: string;
  endsAt: string;
  noPeriodLimit: boolean;
  applySelfServe: boolean;
  applyPlatformProvision: boolean;
  includeCoinGrace: boolean;
  priority: number;
};

const emptyForm = (): FormState => ({
  name: '',
  isActive: true,
  trialDays: 60,
  startsAt: '',
  endsAt: '',
  noPeriodLimit: true,
  applySelfServe: true,
  applyPlatformProvision: true,
  includeCoinGrace: true,
  priority: 0,
});

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formFromItem(item: PlatformSignupTrialEvent): FormState {
  return {
    name: item.name,
    isActive: item.isActive,
    trialDays: item.trialDays,
    startsAt: toLocalInput(item.startsAt),
    endsAt: toLocalInput(item.endsAt),
    noPeriodLimit: !item.startsAt && !item.endsAt,
    applySelfServe: item.applySelfServe,
    applyPlatformProvision: item.applyPlatformProvision,
    includeCoinGrace: item.includeCoinGrace,
    priority: item.priority,
  };
}

function toPayload(form: FormState) {
  return {
    name: form.name.trim(),
    isActive: form.isActive,
    trialDays: form.trialDays,
    startsAt: form.noPeriodLimit || !form.startsAt ? null : new Date(form.startsAt).toISOString(),
    endsAt: form.noPeriodLimit || !form.endsAt ? null : new Date(form.endsAt).toISOString(),
    applySelfServe: form.applySelfServe,
    applyPlatformProvision: form.applyPlatformProvision,
    includeCoinGrace: form.includeCoinGrace,
    priority: form.priority,
  };
}

export function PlatformSignupTrialEventsPage() {
  const [items, setItems] = useState<PlatformSignupTrialEvent[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [policyNote, setPolicyNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async () => {
    const token = getPlatformToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await listPlatformSignupTrialEvents(token);
      setItems(data.items);
      setActiveEventId(data.activeEventId);
      setPolicyNote(data.policyNote);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
    setMessage('');
  };

  const openEdit = (item: PlatformSignupTrialEvent) => {
    setEditingId(item.id);
    setForm(formFromItem(item));
    setFormOpen(true);
    setMessage('');
  };

  const save = async () => {
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const body = toPayload(form);
      if (editingId) await updatePlatformSignupTrialEvent(token, editingId, body);
      else await createPlatformSignupTrialEvent(token, body);
      setFormOpen(false);
      setMessage(editingId ? '이벤트를 저장했습니다.' : '이벤트를 만들었습니다.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: PlatformSignupTrialEvent) => {
    const token = getPlatformToken();
    if (!token) return;
    setError('');
    try {
      await updatePlatformSignupTrialEvent(token, item.id, { isActive: !item.isActive });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '상태 변경 실패');
    }
  };

  const remove = async (item: PlatformSignupTrialEvent) => {
    if (!window.confirm(`「${item.name}」 이벤트를 삭제할까요?`)) return;
    const token = getPlatformToken();
    if (!token) return;
    setError('');
    try {
      await deletePlatformSignupTrialEvent(token, item.id);
      setMessage('삭제했습니다.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">가입 체험 이벤트</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            유료 플랜 가입·개설 시 자동 체험을 켜고 끄는 설정입니다. Free는 항상 체험 없이 시작합니다.
          </p>
        </div>
        <button type="button" className={BTN_PRIMARY} onClick={openCreate}>
          + 이벤트 추가
        </button>
      </div>

      {error ? <PlatformAlert variant="error" message={error} /> : null}
      {message ? <PlatformAlert variant="success" message={message} /> : null}

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm text-indigo-900">
        <div className="font-semibold">
          지금 적용 중:{' '}
          {activeEventId
            ? items.find((i) => i.id === activeEventId)?.name ?? activeEventId
            : '없음 (유료 = 체험 전 · 유료 대기)'}
        </div>
        {policyNote ? <p className="mt-1 text-fluid-xs text-indigo-800/80">{policyNote}</p> : null}
      </div>

      <div className={CARD_SECTION}>
        {loading ? (
          <p className="text-sm text-gray-500">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 이벤트가 없습니다. 추가하면 유료 가입에 자동 체험이 적용됩니다.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border p-3 sm:p-4 ${
                  item.isCurrentlyEffective
                    ? 'border-indigo-200 bg-indigo-50/40'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{item.name}</span>
                      {item.isCurrentlyEffective ? (
                        <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-fluid-2xs font-semibold text-white">
                          적용 중
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-2 py-0.5 text-fluid-2xs font-medium ${
                          item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {item.isActive ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <p className="mt-1 text-fluid-xs text-gray-600">
                      {item.trialDays}일 체험
                      {item.includeCoinGrace ? ' · 코인 grace 포함' : ' · 코인 grace 없음'}
                      {' · '}
                      {item.applySelfServe ? '셀프가입' : ''}
                      {item.applySelfServe && item.applyPlatformProvision ? ' · ' : ''}
                      {item.applyPlatformProvision ? '플랫폼 개설' : ''}
                      {!item.applySelfServe && !item.applyPlatformProvision ? '적용 경로 없음' : ''}
                    </p>
                    <p className="mt-0.5 text-fluid-2xs text-gray-400">
                      기간:{' '}
                      {!item.startsAt && !item.endsAt
                        ? '제한 없음'
                        : `${item.startsAt ? new Date(item.startsAt).toLocaleString('ko-KR') : '시작∞'} ~ ${
                            item.endsAt ? new Date(item.endsAt).toLocaleString('ko-KR') : '종료∞'
                          }`}
                      {' · '}우선순위 {item.priority}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={BTN_SECONDARY} onClick={() => openEdit(item)}>
                      수정
                    </button>
                    <button type="button" className={BTN_SECONDARY} onClick={() => void toggleActive(item)}>
                      {item.isActive ? '끄기' : '켜기'}
                    </button>
                    <button type="button" className={BTN_DANGER} onClick={() => void remove(item)}>
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-base font-bold text-gray-900">
                {editingId ? '이벤트 수정' : '이벤트 추가'}
              </h2>
              <button
                type="button"
                className="text-sm text-gray-500"
                onClick={() => setFormOpen(false)}
              >
                닫기
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <label className="block text-fluid-xs font-medium text-gray-600">
                이벤트명
                <input
                  className={`mt-1 ${INPUT_BASE}`}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="예: 런칭 2개월 무료"
                />
              </label>
              <label className="block text-fluid-xs font-medium text-gray-600">
                체험 일수
                <input
                  type="number"
                  min={1}
                  max={3650}
                  className={`mt-1 ${INPUT_BASE}`}
                  value={form.trialDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, trialDays: Math.max(1, Number(e.target.value) || 1) }))
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                사용 (ON)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.noPeriodLimit}
                  onChange={(e) => setForm((f) => ({ ...f, noPeriodLimit: e.target.checked }))}
                />
                기간 제한 없음
              </label>
              {!form.noPeriodLimit ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="block text-fluid-xs font-medium text-gray-600">
                    시작
                    <input
                      type="datetime-local"
                      className={`mt-1 ${INPUT_BASE}`}
                      value={form.startsAt}
                      onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                    />
                  </label>
                  <label className="block text-fluid-xs font-medium text-gray-600">
                    종료
                    <input
                      type="datetime-local"
                      className={`mt-1 ${INPUT_BASE}`}
                      value={form.endsAt}
                      onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                    />
                  </label>
                </div>
              ) : null}
              <div className="space-y-2 rounded-lg border border-gray-100 bg-slate-50 p-3">
                <div className="text-fluid-xs font-semibold text-gray-700">적용 경로 (유료만)</div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.applySelfServe}
                    onChange={(e) => setForm((f) => ({ ...f, applySelfServe: e.target.checked }))}
                  />
                  셀프 가입 · 유료 전환 승인
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.applyPlatformProvision}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, applyPlatformProvision: e.target.checked }))
                    }
                  />
                  플랫폼 업체 개설
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.includeCoinGrace}
                    onChange={(e) => setForm((f) => ({ ...f, includeCoinGrace: e.target.checked }))}
                  />
                  같은 기간 코인 무제한(grace)
                </label>
              </div>
              <label className="block text-fluid-xs font-medium text-gray-600">
                우선순위 (높을수록 우선)
                <input
                  type="number"
                  className={`mt-1 ${INPUT_BASE}`}
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))}
                />
              </label>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 px-4 py-3">
              <button type="button" className={BTN_SECONDARY} onClick={() => setFormOpen(false)}>
                취소
              </button>
              <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={() => void save()}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
