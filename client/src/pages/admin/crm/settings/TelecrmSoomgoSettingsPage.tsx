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
    const needsActor = password.trim().length > 0 || !hasPassword;
    if (needsActor && !confirmedPassword?.trim()) {
      setPwdModalOpen(true);
      return;
    }
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const cfg = await updateTelecrmSoomgoConfig(token, {
        email,
        password: password.trim() || undefined,
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
              텔레CRM 「숨고 열기」 시 이 계정으로 로컬 브릿지가 숨고에 로그인합니다. 비밀번호는 암호화되어
              저장됩니다.
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
          마케터 PC에서 저장소의{' '}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-fluid-xs">tools/soomgo-bridge/run-bridge.bat</code>{' '}
          을 실행한 뒤 텔레CRM 4열 패널을 사용하세요.
        </p>
      </SettingsCard>

      <DeletePasswordModal
        open={pwdModalOpen}
        title="숨고 계정 저장 확인"
        busy={saving}
        password={actorPassword}
        error={error}
        onPasswordChange={setActorPassword}
        onConfirm={() => void save(actorPassword)}
        onClose={() => {
          setPwdModalOpen(false);
          setActorPassword('');
        }}
      />
    </div>
  );
}
