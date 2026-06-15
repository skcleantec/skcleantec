import { useCallback, useEffect, useState } from 'react';
import {
  fetchTenantCompanyProfile,
  patchTenantCompanyProfile,
  sendTenantCompanyProfileTestEmail,
  type TenantCompanyProfileDto,
} from '../../api/tenantCompanyProfile';
import { getToken } from '../../stores/auth';

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

  const handleSave = async () => {
    if (!token) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const portNum = parseInt(smtpPort, 10);
    try {
      const dto = await patchTenantCompanyProfile(token, {
        companyRegistration: {
          companyName,
          representativeName,
          businessRegistrationNo,
          addressLine,
          phone,
          fax,
          contactEmail,
        },
        smtp: {
          host: smtpHost,
          port: Number.isFinite(portNum) ? portNum : 587,
          secure: smtpSecure,
          user: smtpUser,
          from: smtpFrom,
          ...(smtpPassword ? { password: smtpPassword } : {}),
        },
      });
      hydrate(dto);
      setMsg('저장했습니다.');
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
    <div className="min-w-0 w-full max-w-3xl space-y-6">
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
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">완료본 메일 SMTP</h2>
          <p className="mt-1 text-xs text-gray-500 leading-relaxed">
            현장 검수 청소완료 시 고객에게 보내는 완료본 PDF·메일의 발신 계정입니다. Gmail·네이버 등에서
            앱 비밀번호를 발급해 사용하세요.
            {profile?.globalSmtpFallbackAvailable && (
              <span className="block mt-1 text-amber-800">
                서버 전역 SMTP가 설정되어 있어, 아래를 비워 두면 플랫폼 기본 SMTP로 발송될 수 있습니다.
              </span>
            )}
          </p>
          {smtpReady ? (
            <p className="mt-2 text-xs font-medium text-emerald-700">SMTP 설정됨 — 완료본 메일 발송 가능</p>
          ) : (
            <p className="mt-2 text-xs font-medium text-amber-700">SMTP 미설정 — 완료본 메일이 발송되지 않습니다</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-800">SMTP 호스트</span>
            <input
              type="text"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
              placeholder="smtp.gmail.com"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-800">포트</span>
            <input
              type="number"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              min={1}
              max={65535}
            />
          </label>
          <label className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              checked={smtpSecure}
              onChange={(e) => setSmtpSecure(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-gray-800">SSL/TLS (465 등)</span>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-800">SMTP 로그인 계정</span>
            <input
              type="text"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              autoComplete="off"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-800">발신 표시 (From)</span>
            <input
              type="text"
              value={smtpFrom}
              onChange={(e) => setSmtpFrom(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder={`"${companyName || '회사명'}" <noreply@company.com>`}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-800">SMTP 비밀번호 (앱 비밀번호)</span>
            <input
              type="password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder={passwordConfigured ? '●●●●●●●● (변경 시에만 입력)' : '필수'}
              autoComplete="new-password"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSave()}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">테스트 메일 발송</h3>
        <p className="text-xs text-gray-600">저장 후, 이 업체 SMTP로 테스트 메일을 보낼 수 있습니다.</p>
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
    </div>
  );
}
