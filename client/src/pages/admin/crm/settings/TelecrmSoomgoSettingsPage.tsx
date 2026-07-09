import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SoomgoBridgeManifest } from '@shared/soomgoBridge';
import type { TelecrmCatalogOwnerScope } from '../../../../api/telecrm';
import { getToken } from '../../../../stores/auth';
import {
  fetchTelecrmSoomgoBridgeManifest,
  fetchTelecrmSoomgoConfig,
  updateTelecrmSoomgoConfig,
} from '../../../../api/telecrmSoomgo';
import { DeletePasswordModal, SettingsCard } from '../../../../components/crm/settings/DeletePasswordModal';
import { TelecrmSoomgoMessagePresetsSection } from '../../../../components/crm/settings/TelecrmSoomgoMessagePresetsSection';

export function TelecrmSoomgoSettingsPage({
  catalogScope: catalogScopeProp,
  presetsInDrawer = false,
}: {
  catalogScope?: TelecrmCatalogOwnerScope;
  /** CRM 설정 드로어 — 프리셋은 「숨고 프리셋」 탭에서 편집 */
  presetsInDrawer?: boolean;
} = {}) {
  const [searchParams] = useSearchParams();
  const catalogScope: TelecrmCatalogOwnerScope =
    catalogScopeProp ?? (searchParams.get('catalog') === 'shared' ? 'shared' : 'personal');
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
  const [bridgeManifest, setBridgeManifest] = useState<SoomgoBridgeManifest | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    if (catalogScope !== 'shared') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [cfg, manifest] = await Promise.all([
        fetchTelecrmSoomgoConfig(token),
        fetchTelecrmSoomgoBridgeManifest(token).catch(() => null),
      ]);
      setEmail(cfg.email);
      setHasPassword(cfg.hasPassword);
      setEnabled(cfg.enabled);
      setBridgeManifest(manifest);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token, catalogScope]);

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

      {catalogScope === 'shared' ? (
        <>
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
                  텔레CRM 작업 화면 <strong>설정 → 숨고 연동</strong>에서 저장합니다.
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

          <SettingsCard title="숨고 연동 프로그램 (PC)">
            <div className="space-y-3 text-fluid-sm text-gray-600">
              <p>
                상담사 PC에 <strong>「청소비서 숨고 연동」</strong> 프로그램을 설치·실행합니다. 트레이 아이콘이
                떠 있으면 텔레CRM 상단 <strong>숨고 연동</strong> 바에서 Chrome 숨고와 연결할 수 있습니다.
                별도 주소 입력 없이 cbiseo.com·스테이징·개발 환경을 자동으로 연결합니다.
              </p>
              {bridgeManifest ? (
                <p>
                  최신 버전: <strong>v{bridgeManifest.latestVersion}</strong>
                  {bridgeManifest.releaseNotes ? (
                    <span className="text-gray-500"> — {bridgeManifest.releaseNotes}</span>
                  ) : null}
                </p>
              ) : null}
              {bridgeManifest?.downloadUrl ? (
                <a
                  href={bridgeManifest.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-semibold text-white hover:bg-slate-800"
                >
                  설치 프로그램 다운로드
                </a>
              ) : (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                  설치 파일 URL이 아직 설정되지 않았습니다. 관리자가 Railway에 다운로드 주소를 등록하면
                  여기서 Setup 설치 파일을 받을 수 있습니다. 개발 PC는{' '}
                  <code className="rounded bg-white px-1 py-0.5 text-fluid-xs">run-desktop.bat</code> 로 실행하세요.
                </p>
              )}
              <ul className="list-disc space-y-1 pl-5 text-fluid-xs text-gray-500">
                <li>설치 파일을 실행하면 안내에 따라 진행합니다. 서버 주소는 입력하지 않아도 됩니다.</li>
                <li>설치 후 트레이 아이콘이 보이면 텔레CRM 숨고 연동을 사용할 수 있습니다.</li>
                <li>
                  개발용: <code className="rounded bg-gray-100 px-1 py-0.5">run-desktop.bat</code> 또는{' '}
                  <code className="rounded bg-gray-100 px-1 py-0.5">run-bridge.bat</code>
                </li>
              </ul>
            </div>
          </SettingsCard>
        </>
      ) : null}

      {!presetsInDrawer ? (
        <SettingsCard title={catalogScope === 'personal' ? '내 숨고 메시지 프리셋' : '공유 숨고 메시지 프리셋'}>
          <TelecrmSoomgoMessagePresetsSection catalogScope={catalogScope} />
        </SettingsCard>
      ) : null}

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
