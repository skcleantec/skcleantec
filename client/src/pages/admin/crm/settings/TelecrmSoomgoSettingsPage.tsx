import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../../../stores/auth';
import {
  fetchTelecrmSoomgoConfig,
  updateTelecrmSoomgoConfig,
} from '../../../../api/telecrmSoomgo';
import { DeletePasswordModal, SettingsCard } from '../../../../components/crm/settings/DeletePasswordModal';

export function TelecrmSoomgoSettingsPage() {
  const token = getToken();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [actorPassword, setActorPassword] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const cfg = await fetchTelecrmSoomgoConfig(token);
      setEmail(cfg.email);
      setHasPassword(cfg.hasPassword);
      setEnabled(cfg.enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (confirmedPassword?: string) => {
    if (!token) return;
    const soomgoPasswordToSend = password.trim() || undefined;
    if (!hasPassword && !soomgoPasswordToSend) {
      setError('숨고 비밀번호를 입력해 주세요.');
      return;
    }
    if (soomgoPasswordToSend && !confirmedPassword?.trim()) {
      setError(null);
      setPwdModalOpen(true);
      return;
    }
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const cfg = await updateTelecrmSoomgoConfig(token, {
        email,
        password: soomgoPasswordToSend,
        enabled,
        actorPassword: confirmedPassword,
      });
      setHasPassword(cfg.hasPassword);
      setPassword('');
      setMsg('숨고 연동 계정을 저장했습니다.');
      window.setTimeout(() => setMsg(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
      setPwdModalOpen(false);
      setActorPassword('');
    }
  };

  return (
    <div className="space-y-4">
      {msg ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-fluid-sm text-green-800">{msg}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-700">{error}</p>
      ) : null}

      <SettingsCard
        title="숨고 연동 계정"
        actions={
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void save()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm text-white disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        }
      >
        {loading ? (
          <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
        ) : (
          <div className="space-y-4">
            <p className="text-fluid-sm text-gray-600">
              텔레CRM 작업 화면 <strong>설정 → 숨고 연동</strong> 또는 관리자 메뉴의 숨고 연동에서 저장합니다.
              「숨고 보조창」 열기 시 이 계정으로 자동 로그인됩니다.
            </p>
            <label className="block space-y-1">
              <span className="text-fluid-sm font-medium text-gray-700">숨고 이메일</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-fluid-sm font-medium text-gray-700">
                숨고 비밀번호 {hasPassword ? '(변경 시에만 입력)' : ''}
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasPassword ? '••••••••' : ''}
                className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
                autoComplete="new-password"
              />
            </label>
            <label className="flex items-center gap-2 text-fluid-sm text-gray-700">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-gray-300"
              />
              숨고 연동 사용
            </label>
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="로컬 브릿지 실행">
        <p className="text-fluid-sm text-gray-600">
          마케터 PC에서{' '}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-fluid-xs">tools/soomgo-bridge/run-bridge.bat</code>{' '}
          실행 후, 텔레CRM 왼쪽 도구의 <strong>숨고 연동</strong>으로 상단 바를 열고 Chrome 숨고를 연결합니다.
        </p>
      </SettingsCard>

      <DeletePasswordModal
        open={pwdModalOpen}
        title="숨고 계정 저장 확인"
        description="숨고 비밀번호를 저장하려면 텔레CRM 로그인 비밀번호를 입력해 주세요."
        confirmLabel="저장"
        confirmBusyLabel="저장 중…"
        variant="primary"
        busy={saving}
        password={actorPassword}
        error={pwdModalOpen ? error : null}
        onPasswordChange={setActorPassword}
        onConfirm={() => void save(actorPassword)}
        onClose={() => {
          setPwdModalOpen(false);
          setActorPassword('');
          setError(null);
        }}
      />
    </div>
  );
}
