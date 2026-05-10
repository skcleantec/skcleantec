import { useEffect, useRef, useState } from 'react';
import { isAuthSessionExpiredError, updateMyProfile } from '../../api/auth';

type MeUser = {
  name?: string | null;
  phone?: string | null;
  vehicleNumber?: string | null;
  role?: string | null;
  /** 팀장 전용 로마자 이름 */
  nameEn?: string | null;
};

export function UserProfileMenu({
  token,
  me,
  loading,
  /** 팀장(/team) 영역: 역할 로드 전에도 차량번호 입력 표시·픽업 안내 */
  teamProfileVehicleField,
  /** 팀 화면 미리보기(개발자) — JWT 역할이 ADMIN이어도 차량번호 입력 표시 */
  showVehicleForPreviewAdmin,
  onSaved,
  onLogout,
  onSessionExpired,
  showStagingDbImport,
  onStagingDbImport,
}: {
  token: string | null;
  me: MeUser | null;
  loading?: boolean;
  teamProfileVehicleField?: boolean;
  showVehicleForPreviewAdmin?: boolean;
  onSaved?: (next: {
    name: string;
    phone: string | null;
    vehicleNumber: string | null;
    nameEn?: string | null;
  }) => void;
  onLogout: () => void;
  onSessionExpired?: () => void;
  /** 스테이징 등에서만 서버가 true로 내려줌 */
  showStagingDbImport?: boolean;
  onStagingDbImport?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const openProfileModal = () => {
    setMenuOpen(false);
    setName((me?.name ?? '').trim());
    setPhone((me?.phone ?? '').trim());
    setVehicleNumber((me?.vehicleNumber ?? '').trim());
    setNameEn((me?.nameEn ?? '').trim());
    setPassword('');
    setModalOpen(true);
  };

  const submit = async () => {
    if (!token) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('이름을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const payload: Parameters<typeof updateMyProfile>[1] = {
        name: trimmedName,
        phone: phone.trim() ? phone.trim() : null,
        vehicleNumber: vehicleNumber.trim() ? vehicleNumber.trim() : null,
        password: password.trim() ? password.trim() : undefined,
      };
      if (me?.role === 'TEAM_LEADER') {
        payload.nameEn = nameEn.trim() ? nameEn.trim() : null;
      }
      const updated = await updateMyProfile(token, payload);
      onSaved?.({
        name: String(updated.name ?? trimmedName),
        phone: updated.phone == null ? null : String(updated.phone),
        vehicleNumber: updated.vehicleNumber == null ? null : String(updated.vehicleNumber),
        ...(me?.role === 'TEAM_LEADER'
          ? { nameEn: updated.nameEn == null ? null : String(updated.nameEn) }
          : {}),
      });
      setModalOpen(false);
    } catch (e) {
      if (isAuthSessionExpiredError(e)) {
        onSessionExpired?.();
        return;
      }
      alert(e instanceof Error ? e.message : '개인정보 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const displayName = (me?.name ?? '').trim() || '사용자';
  const showVehicleNumber =
    me?.role === 'TEAM_LEADER' ||
    me?.role === 'EXTERNAL_PARTNER' ||
    Boolean(teamProfileVehicleField && (me?.role == null || me?.role === '')) ||
    Boolean(showVehicleForPreviewAdmin);

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
        >
          <span className="max-w-[7rem] truncate">{loading ? '계정 확인 중…' : displayName}</span>
          <span aria-hidden>▾</span>
        </button>
        {menuOpen ? (
          <div className="absolute right-0 z-[140] mt-1 min-w-[11rem] w-max max-w-[min(100vw-2rem,16rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            <button
              type="button"
              onClick={openProfileModal}
              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              개인정보 수정
            </button>
            {showStagingDbImport && onStagingDbImport ? (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onStagingDbImport();
                }}
                className="block w-full px-3 py-2 text-left text-sm text-amber-900 hover:bg-amber-50"
              >
                운영 DB 가져오기
              </button>
            ) : null}
            <button
              type="button"
              onClick={onLogout}
              className="block w-full border-t border-gray-100 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              로그아웃
            </button>
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="개인정보 수정"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-2xl"
          >
            <h2 className="text-base font-semibold text-gray-900">개인정보 수정</h2>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-gray-600">이름</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="이름"
                />
              </label>
              {me?.role === 'TEAM_LEADER' ? (
                <label className="block">
                  <span className="mb-1 block text-xs text-gray-600">영문 이름 (선택)</span>
                  <input
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    maxLength={128}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    placeholder="예: Kim Cheolsu"
                    autoComplete="off"
                  />
                  <p className="mt-1 text-fluid-2xs text-gray-500 leading-snug">
                    크루 「현장 일정」 배정 팀장 옆에 함께 표시됩니다.
                  </p>
                </label>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-xs text-gray-600">전화번호</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="010-0000-0000"
                />
              </label>
              {showVehicleNumber ? (
                <label className="block">
                  <span className="mb-1 block text-xs text-gray-600">개인 차량번호</span>
                  <input
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    maxLength={64}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    placeholder="예: 123가4567"
                    autoComplete="off"
                  />
                  {teamProfileVehicleField && showVehicleNumber ? (
                    <p className="mt-1.5 text-fluid-2xs text-gray-500 leading-snug">
                      팀원 픽업 등 안내 메시지에 자동으로 넣을 수 있도록 저장됩니다. (선택)
                      {showVehicleForPreviewAdmin ? (
                        <span className="mt-1 block text-gray-500">
                          팀 화면 미리보기(개발자) 계정에서도 동일하게 저장·확인할 수 있습니다.
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </label>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-xs text-gray-600">새 비밀번호 (선택)</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="변경할 때만 입력"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving}
                className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
