import { useCallback, useEffect, useState } from 'react';
import {
  fetchTenantCompanyProfile,
  patchTenantCompanyProfile,
  sendTenantCompanyProfileTestEmail,
  type TenantCompanyProfileDto,
} from '../../api/tenantCompanyProfile';
import { getToken } from '../../stores/auth';
import { TenantSmtpFieldLabel } from '../../components/admin/TenantSmtpFieldLabel';
import {
  PROVIDER_PRESETS,
  TenantSmtpSetupGuideModal,
} from '../../components/admin/TenantSmtpSetupGuideModal';

export function AdminTenantCompanyProfilePage() {
  const token = getToken();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [profile, setProfile] = useState<TenantCompanyProfileDto | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [businessRegistrationNo, setBusinessRegistrationNo] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [phone, setPhone] = useState('');
  const [fax, setFax] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);

  const hydrate = useCallback((dto: TenantCompanyProfileDto) => {
    setProfile(dto);
    const c = dto.companyRegistration;
    setCompanyName(c.companyName ?? '');
    setRepresentativeName(c.representativeName ?? '');
    setBusinessRegistrationNo(c.businessRegistrationNo ?? '');
    setAddressLine(c.addressLine ?? '');
    setPhone(c.phone ?? '');
    setFax(c.fax ?? '');
    setContactEmail(c.contactEmail ?? '');
    setSmtpHost(dto.smtp.host);
    setSmtpPort(String(dto.smtp.port || 587));
    setSmtpSecure(dto.smtp.secure);
    setSmtpUser(dto.smtp.user);
    setSmtpFrom(dto.smtp.from);
    setPasswordConfigured(dto.smtp.passwordConfigured);
    setSmtpPassword('');
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const dto = await fetchTenantCompanyProfile(token);
      hydrate(dto);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token, hydrate]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (scope: 'all' | 'company' | 'smtp' = 'all') => {
    if (!token) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const portNum = parseInt(smtpPort, 10);
    const companyPayload = {
      companyName,
      representativeName,
      businessRegistrationNo,
      addressLine,
      phone,
      fax,
      contactEmail,
    };
    const smtpPayload = {
      host: smtpHost,
      port: Number.isFinite(portNum) ? portNum : 587,
      secure: smtpSecure,
      user: smtpUser,
      from: smtpFrom,
      ...(smtpPassword ? { password: smtpPassword } : {}),
    };
    try {
      const patch =
        scope === 'company'
          ? { companyRegistration: companyPayload }
          : scope === 'smtp'
            ? { smtp: smtpPayload }
            : { companyRegistration: companyPayload, smtp: smtpPayload };
      const dto = await patchTenantCompanyProfile(token, patch);
      hydrate(dto);
      setMsg(
        scope === 'company'
          ? '사업자 정보를 저장했습니다.'
          : scope === 'smtp'
            ? '메일 설정을 저장했습니다.'
            : '저장했습니다.',
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleTestEmail = async () => {
    if (!token) return;
    const to = testEmailTo.trim() || contactEmail.trim();
    if (!to) {
      setErr('테스트 수신 이메일을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await sendTenantCompanyProfileTestEmail(token, to);
      setMsg(`테스트 메일을 ${to}(으)로 발송했습니다.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '테스트 발송 실패');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">불러오는 중…</div>;
  }

  const smtpReady = profile?.smtp.configured;

  return (
    <div className="min-w-0 w-full max-w-3xl space-y-6 pb-24">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">업체등록정보</h1>
        <p className="mt-1 text-sm text-gray-500">
          사업자 정보와 현장 검수 완료본 발송용 SMTP를 이 업체(테넌트) 기준으로 설정합니다.
        </p>
      </div>

      {err && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {err}
        </p>
      )}
      {msg && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          {msg}
        </p>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">사업자 정보</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-800">상호(회사명)</span>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-800">대표자명</span>
            <input
              type="text"
              value={representativeName}
              onChange={(e) => setRepresentativeName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-800">사업자등록번호</span>
            <input
              type="text"
              value={businessRegistrationNo}
              onChange={(e) => setBusinessRegistrationNo(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="000-00-00000"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-800">사업장 주소</span>
            <input
              type="text"
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-800">전화</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-800">팩스</span>
            <input
              type="text"
              value={fax}
              onChange={(e) => setFax(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-800">업체 대표 이메일</span>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="contact@company.com"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSave('company')}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? '저장 중…' : '사업자 정보 저장'}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-gray-900">고객 완료본 메일 발송 설정</h2>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">
              현장 검수 청소완료 시 고객에게 보내는 완료본 PDF·메일을, 업체 메일 계정으로 발송합니다.
              Gmail·네이버 등에서 앱 비밀번호(또는 메일 전용 비밀번호)를 준비해 주세요.
              {profile?.globalSmtpFallbackAvailable && (
                <span className="block mt-1 text-amber-800">
                  서버 기본 SMTP가 있어 아래를 비워 두면 플랫폼 계정으로 발송될 수 있습니다. 고객에게는
                  업체 이름·메일로 보내려면 여기서 설정하세요.
                </span>
              )}
            </p>
            {smtpReady ? (
              <p className="mt-2 text-xs font-medium text-emerald-700">설정 완료 — 완료본 메일 발송 가능</p>
            ) : (
              <p className="mt-2 text-xs font-medium text-amber-700">미설정 — 완료본 메일이 발송되지 않습니다</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="shrink-0 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-100"
          >
            설정 방법 보기
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="w-full text-[11px] font-medium text-gray-500">빠른 입력 (서버·포트만 채움)</span>
          {PROVIDER_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                setSmtpHost(preset.host);
                setSmtpPort(preset.port);
                setSmtpSecure(preset.secure);
              }}
              className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-800 hover:bg-gray-50"
            >
              {preset.name}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <TenantSmtpFieldLabel
              title="메일 서버 주소"
              technicalTerm="SMTP 호스트"
              hint="예: smtp.gmail.com, smtp.naver.com"
              helpText={`메일 업체가 안내하는 SMTP 서버 주소입니다.\nGmail: smtp.gmail.com\n네이버: smtp.naver.com`}
            />
            <input
              type="text"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
              placeholder="smtp.gmail.com"
            />
          </label>
          <label className="block">
            <TenantSmtpFieldLabel
              title="연결 포트"
              technicalTerm="Port"
              hint="Gmail·네이버는 보통 587"
              helpText="587: 일반 연결(SSL 체크 해제)\n465: SSL 암호화 연결(SSL 체크)"
            />
            <input
              type="number"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              min={1}
              max={65535}
            />
          </label>
          <label className="flex items-start gap-2 pt-1 sm:pt-6">
            <input
              type="checkbox"
              checked={smtpSecure}
              onChange={(e) => setSmtpSecure(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span className="min-w-0">
              <span className="text-sm font-medium text-gray-800">SSL 암호화 연결</span>
              <span className="block text-[11px] text-gray-400">(465 포트·다음/카카오 등)</span>
              <span className="block text-xs text-gray-500 mt-0.5">Gmail·네이버 587 사용 시 체크 해제</span>
            </span>
          </label>
          <label className="block sm:col-span-2">
            <TenantSmtpFieldLabel
              title="메일 계정"
              technicalTerm="로그인 이메일"
              hint="메일함 로그인에 쓰는 전체 주소 (@ 포함)"
              helpText={`Gmail은 you@gmail.com 처럼 @까지 전부 입력하세요.\n로그인 계정과 「보내는 사람」 이메일이 같으면 오류가 적습니다.`}
            />
            <input
              type="text"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="your@gmail.com"
              autoComplete="off"
            />
          </label>
          <label className="block sm:col-span-2">
            <TenantSmtpFieldLabel
              title="보내는 사람 표시"
              technicalTerm="From"
              hint="고객 메일함에 보이는 이름·주소"
              helpText={`예: "${companyName || '회사명'}" <your@gmail.com>\n이메일 부분은 위 「메일 계정」과 같은 주소를 권장합니다.`}
            />
            <input
              type="text"
              value={smtpFrom}
              onChange={(e) => setSmtpFrom(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder={`"${companyName || '회사명'}" <noreply@company.com>`}
            />
          </label>
          <label className="block sm:col-span-2">
            <TenantSmtpFieldLabel
              title="앱 비밀번호"
              technicalTerm="SMTP 비밀번호"
              hint="일반 로그인 비밀번호가 아닌, 메일 연동용 비밀번호"
              helpText={`Gmail: Google 계정 → 보안 → 앱 비밀번호 (16자리)\n네이버: 메일 환경설정에서 SMTP 사용 후 네이버 비밀번호\n저장 후에는 ●●●● 로만 표시됩니다. 변경할 때만 다시 입력하세요.`}
            />
            <input
              type="password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder={passwordConfigured ? '●●●●●●●● (변경 시에만 입력)' : '앱 비밀번호 입력 (필수)'}
              autoComplete="new-password"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSave('smtp')}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? '저장 중…' : '메일 설정 저장'}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">테스트 메일 발송</h3>
        <p className="text-xs text-gray-600">
          저장한 뒤, 위 설정으로 본인 메일함에 테스트 메일을 보내 연결을 확인할 수 있습니다.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="text-xs text-gray-700">수신 이메일</span>
            <input
              type="email"
              value={testEmailTo}
              onChange={(e) => setTestEmailTo(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder={contactEmail || 'test@example.com'}
            />
          </label>
          <button
            type="button"
            disabled={busy || !smtpReady}
            onClick={() => void handleTestEmail()}
            className="rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
          >
            테스트 발송
          </button>
        </div>
      </section>

      {guideOpen && (
        <TenantSmtpSetupGuideModal companyName={companyName} onClose={() => setGuideOpen(false)} />
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSave('all')}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? '저장 중…' : '전체 저장'}
          </button>
          <button
            type="button"
            disabled={busy || !smtpReady}
            onClick={() => void handleTestEmail()}
            className="rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
          >
            테스트 발송
          </button>
        </div>
      </div>
    </div>
  );
}
