import { useCallback, useEffect, useState } from 'react';
import {
  createTenantSupportAccess,
  listTenantSupportAccess,
  patchTenantSupportAccess,
  suggestTenantSupportAccess,
  type TenantSupportAccessRow,
} from '../../api/platformSupportAccess';
import { getPlatformToken } from '../../stores/platformAuth';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD_SECTION,
  INPUT_BASE,
  PlatformToggle,
} from '../../utils/platformUi';
import { tenantLoginIdErrorMessage } from '@shared/tenantLoginId';

type CreateForm = {
  loginId: string;
  password: string;
  name: string;
  memo: string;
};

type EditDraft = {
  loginId: string;
  password: string;
  name: string;
  memo: string;
  isActive: boolean;
};

const EMPTY_CREATE: CreateForm = { loginId: '', password: '', name: '플랫폼 지원', memo: '' };

function formatWhen(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR');
}

export function PlatformSupportAccessPage() {
  const [items, setItems] = useState<TenantSupportAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);

  const load = useCallback(async () => {
    const token = getPlatformToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setItems(await listTenantSupportAccess(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fillSuggest = async () => {
    const token = getPlatformToken();
    if (!token) return;
    try {
      const s = await suggestTenantSupportAccess(token);
      setCreateForm((f) => ({ ...f, loginId: s.loginId, password: s.password }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '추천 생성 실패');
    }
  };

  const handleCreate = async () => {
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setError('');
    setMessage('');
    setCreatedPassword(null);
    try {
      const result = await createTenantSupportAccess(token, {
        loginId: createForm.loginId.trim(),
        password: createForm.password,
        name: createForm.name.trim(),
        memo: createForm.memo.trim() || undefined,
      });
      setCreatedPassword(result.initialPassword);
      setMessage(`지원 접속 계정「${result.account.loginId}」이 생성되었습니다.`);
      setCreateForm(EMPTY_CREATE);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성 실패');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: TenantSupportAccessRow) => {
    setEditingId(row.id);
    setDraft({
      loginId: row.loginId,
      name: row.name,
      memo: row.memo ?? '',
      password: '',
      isActive: row.isActive,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !draft) return;
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await patchTenantSupportAccess(token, editingId, {
        loginId: draft.loginId.trim(),
        name: draft.name.trim(),
        memo: draft.memo.trim() || null,
        isActive: draft.isActive,
        ...(draft.password.trim() ? { password: draft.password.trim() } : {}),
      });
      setMessage('저장되었습니다.');
      setEditingId(null);
      setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">지원 접속 계정</h1>
        <p className="mt-1 text-sm text-gray-600">
          장애·운영 대응용 아이디입니다.{' '}
          <strong className="font-medium text-gray-800">어느 업체 코드로든</strong> 일반 관리자 로그인(
          <code className="text-xs">/login</code>)과 동일하게 <code className="text-xs">/admin</code>에
          접속할 수 있습니다. 업체별 관리자 목록에는 표시되지 않습니다.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
          {createdPassword ? (
            <p className="mt-2 font-mono text-xs">
              초기 비밀번호: <span className="font-semibold">{createdPassword}</span> (이 화면을 벗어나면 다시
              표시되지 않습니다)
            </p>
          ) : null}
        </div>
      ) : null}

      <section className={CARD_SECTION}>
        <h2 className="text-sm font-semibold text-gray-900">새 계정 발급</h2>
        <p className="text-xs text-gray-500">{tenantLoginIdErrorMessage()}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-700">아이디</span>
            <input
              className={INPUT_BASE}
              value={createForm.loginId}
              onChange={(e) => setCreateForm((f) => ({ ...f, loginId: e.target.value }))}
              placeholder="ops-xxxx"
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-700">비밀번호</span>
            <input
              className={INPUT_BASE}
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="비우면 자동 생성"
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-700">표시 이름</span>
            <input
              className={INPUT_BASE}
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-gray-700">메모 (선택)</span>
            <input
              className={INPUT_BASE}
              value={createForm.memo}
              onChange={(e) => setCreateForm((f) => ({ ...f, memo: e.target.value }))}
              placeholder="담당자·용도 등"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN_SECONDARY} disabled={saving} onClick={() => void fillSuggest()}>
            아이디·비밀번호 추천
          </button>
          <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={() => void handleCreate()}>
            {saving ? '생성 중…' : '계정 생성'}
          </button>
        </div>
      </section>

      <section className={CARD_SECTION}>
        <h2 className="text-sm font-semibold text-gray-900">발급된 계정</h2>
        {loading ? (
          <p className="text-sm text-gray-500">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 지원 접속 계정이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
            {items.map((row) => {
              const editing = editingId === row.id && draft;
              return (
                <li key={row.id} className="bg-white px-4 py-4">
                  {editing ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm">
                          <span className="mb-1 block text-gray-700">아이디</span>
                          <input
                            className={INPUT_BASE}
                            value={draft.loginId}
                            onChange={(e) => setDraft((d) => (d ? { ...d, loginId: e.target.value } : d))}
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="mb-1 block text-gray-700">새 비밀번호 (변경 시만)</span>
                          <input
                            className={INPUT_BASE}
                            value={draft.password}
                            onChange={(e) => setDraft((d) => (d ? { ...d, password: e.target.value } : d))}
                            autoComplete="new-password"
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="mb-1 block text-gray-700">표시 이름</span>
                          <input
                            className={INPUT_BASE}
                            value={draft.name}
                            onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                          />
                        </label>
                        <label className="block text-sm sm:col-span-2">
                          <span className="mb-1 block text-gray-700">메모</span>
                          <input
                            className={INPUT_BASE}
                            value={draft.memo}
                            onChange={(e) => setDraft((d) => (d ? { ...d, memo: e.target.value } : d))}
                          />
                        </label>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-700">활성</span>
                        <PlatformToggle
                          checked={draft.isActive}
                          disabled={saving}
                          onChange={() => setDraft((d) => (d ? { ...d, isActive: !d.isActive } : d))}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={() => void handleSaveEdit()}>
                          저장
                        </button>
                        <button
                          type="button"
                          className={BTN_SECONDARY}
                          onClick={() => {
                            setEditingId(null);
                            setDraft(null);
                          }}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-gray-900">{row.loginId}</span>
                          {!row.isActive ? (
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">비활성</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-sm text-gray-700">{row.name}</p>
                        {row.memo ? <p className="mt-1 text-xs text-gray-500">{row.memo}</p> : null}
                        <p className="mt-2 text-[11px] text-gray-400">
                          마지막 접속 {formatWhen(row.lastUsedAt)} · 생성 {formatWhen(row.createdAt)}
                        </p>
                      </div>
                      <button type="button" className={BTN_SECONDARY} onClick={() => startEdit(row)}>
                        수정
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
