import { useCallback, useEffect, useState } from 'react';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { Link } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  createServiceZone,
  deleteServiceZone,
  listServiceZones,
  updateServiceZone,
  type ServiceZoneItem,
} from '../../api/serviceZones';
import { createUserCustomCalendar, getUserCustomCalendars } from '../../api/userCustomCalendars';
import { pickAutoColorKey } from '../../constants/customCalendarColors';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { KoreanRegionPicker } from '../../components/admin/KoreanRegionPicker';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

type FormState = { name: string; regions: string[]; isActive: boolean };

function emptyForm(): FormState {
  return { name: '', regions: [], isActive: true };
}

export function AdminServiceZonesPage() {
  const token = getToken();
  const [items, setItems] = useState<ServiceZoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceZoneItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceZoneItem | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  /** 권역 추가 시 스케줄 맞춤 캘린더 자동 생성 (기본 켜짐) */
  const [autoCreateCalendar, setAutoCreateCalendar] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listServiceZones(token, { includeInactive: true });
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setAutoCreateCalendar(true);
    setModalOpen(true);
  }

  function openEdit(row: ServiceZoneItem) {
    setEditing(row);
    setForm({ name: row.name, regions: [...row.regions], isActive: row.isActive });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!token) return;
    if (!form.name.trim()) {
      alert('권역 이름을 입력해 주세요.');
      return;
    }
    if (form.regions.length === 0) {
      alert('담당 지역을 1개 이상 선택해 주세요.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateServiceZone(token, editing.id, {
          name: form.name.trim(),
          regions: form.regions,
          isActive: form.isActive,
        });
      } else {
        const created = await createServiceZone(token, { name: form.name.trim(), regions: form.regions });
        if (autoCreateCalendar) {
          try {
            const calendars = await getUserCustomCalendars(token);
            const usedColors = calendars.map((c) => c.colorKey);
            await createUserCustomCalendar(token, {
              name: form.name.trim(),
              regions: form.regions,
              serviceZoneId: created.id,
              colorKey: pickAutoColorKey(usedColors),
            });
          } catch (calErr) {
            const msg = calErr instanceof Error ? calErr.message : '캘린더 생성에 실패했습니다.';
            alert(
              `권역은 저장됐지만 맞춤 캘린더 자동 생성에 실패했습니다. 스케줄에서 수동으로 추가해 주세요.\n\n${msg}`,
            );
          }
        }
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!token || !deleteTarget) return;
    if (!deletePassword.trim()) {
      alert('비밀번호를 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await deleteServiceZone(token, deleteTarget.id, deletePassword);
      setDeleteTarget(null);
      setDeletePassword('');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-fluid-xs text-slate-500 mb-1">
            <Link to="/admin/schedule" className="hover:text-slate-800 underline-offset-2 hover:underline">
              스케줄
            </Link>
            {' · '}
            서비스 권역
          </p>
          <PageTitleWithFavorite label="서비스 권역">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">서비스 권역</h1>
        </PageTitleWithFavorite>
          <p className="text-fluid-sm text-slate-600 mt-1 max-w-2xl">
            팀장 담당 지역·지역 캘린더·배정 규칙의 공통 기준입니다. 권역을 만든 뒤{' '}
            <Link to="/admin/team-leaders" className="font-medium text-violet-800 underline underline-offset-2">
              사용자 등록 → 팀장
            </Link>
            에서 담당 권역을 지정하세요. 권역 추가 시 맞춤 캘린더를 함께 만들 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          권역 추가
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">등록된 권역이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((z) => (
              <li key={z.id} className="px-4 py-4 sm:px-5 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{z.name}</span>
                    {!z.isActive ? (
                      <span className="text-[11px] font-medium rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">
                        비활성
                      </span>
                    ) : null}
                  </div>
                  <p className="text-fluid-xs text-slate-600 mt-1 break-words">{z.regions.join(', ')}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(z)}
                    className="text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(z);
                      setDeletePassword('');
                    }}
                    className="text-sm text-rose-700 border border-rose-200 rounded-lg px-3 py-1.5 hover:bg-rose-50"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
          <div className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl border border-slate-200">
            <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-3">
              <h2 className="font-semibold text-slate-900">{editing ? '권역 수정' : '권역 추가'}</h2>
              <ModalCloseButton onClick={() => setModalOpen(false)} />
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">권역 이름</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="예: 수원권"
                />
              </div>
              <KoreanRegionPicker
                selectId="service-zone-region"
                value={form.regions}
                onChange={(regions) => setForm((p) => ({ ...p, regions }))}
                helpText="맞춤 캘린더·접수 주소 매칭과 동일합니다. 경기도·충청남도 등 시·도 전체 또는 시·군 단위로 지정하세요."
              />
              {!editing ? (
                <label className="flex items-start gap-2 rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-3 text-sm text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreateCalendar}
                    onChange={(e) => setAutoCreateCalendar(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      스케줄 맞춤 캘린더도 함께 만들기
                      <HelpTooltip
                        className="shrink-0"
                        text="체크하면 권역과 같은 이름·지역·권역 연결로 내 스케줄 캘린더 탭이 자동 생성됩니다. 스케줄 화면에서 바로 해당 탭으로 배정·TO 확인을 시작할 수 있습니다."
                      />
                    </span>
                    <span className="block text-xs text-slate-500 mt-1 leading-snug">
                      권역 이름과 동일한 탭이 스케줄에 추가됩니다.
                    </span>
                  </span>
                </label>
              ) : null}
              {editing ? (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  활성 (비활성 시 신규 배정 후보에서 제외)
                </label>
              ) : null}
            </div>
            <div className="border-t border-slate-100 px-4 py-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-5 space-y-3">
            <h3 className="font-semibold text-slate-900">권역 삭제</h3>
            <p className="text-sm text-slate-600">
              「{deleteTarget.name}」을(를) 삭제합니다. 연결된 맞춤 캘린더가 있으면 삭제할 수 없습니다.
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="본인 비밀번호"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleConfirmDelete()}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
