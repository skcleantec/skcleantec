import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchPublicLegalSession,
  submitPublicLegalAgreement,
  type PublicLegalSession,
} from '../../api/platformLegal';

function formatKst(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  } catch {
    return iso;
  }
}

export function LegalAgreePublicPage() {
  const { token } = useParams<{ token: string }>();
  const decoded = decodeURIComponent(token || '').trim();

  const [session, setSession] = useState<PublicLegalSession | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerPhone, setSignerPhone] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [agreed, setAgreed] = useState(false);

  const load = useCallback(async () => {
    if (!decoded) return;
    setLoadErr(null);
    try {
      const { session: s } = await fetchPublicLegalSession(decoded);
      setSession(s);
    } catch (e) {
      setSession(null);
      setLoadErr(e instanceof Error ? e.message : '불러오지 못했습니다.');
    }
  }, [decoded]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!decoded || !session || session.alreadyAgreed) return;
    if (!companyName.trim() || !signerName.trim() || !signerTitle.trim()) {
      setMsg('회사명·이름·직책을 입력해 주세요.');
      return;
    }
    if (!agreed) {
      setMsg('약관 내용에 동의해 주세요.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await submitPublicLegalAgreement(decoded, {
        companyName: companyName.trim(),
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim(),
        signerEmail: signerEmail.trim() || undefined,
        signerPhone: signerPhone.trim() || undefined,
        tenantSlug: tenantSlug.trim() || undefined,
        agreed: true,
      });
      await load();
      setMsg('동의가 완료되었습니다. 감사합니다.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '제출에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-6 text-center">
          <p className="text-xs font-medium text-slate-500">청소비서 · (주)서비스브릿지</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">약관·계약 동의</h1>
        </header>

        {loadErr ? (
          <div className="rounded-2xl border border-red-200 bg-white p-6 text-center text-sm text-red-700">
            {loadErr}
          </div>
        ) : null}

        {!loadErr && !session ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            불러오는 중…
          </div>
        ) : null}

        {session ? (
          <div className="space-y-4">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">{session.document.title}</h2>
              <p className="mt-1 text-xs text-gray-500">문서 버전 v{session.document.version}</p>
              <div
                className="legal-document-body mt-4 max-h-[50vh] overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/80 p-4 text-sm text-gray-800 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: session.document.contentHtml }}
              />
            </section>

            {session.alreadyAgreed ? (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
                <p className="font-semibold">이미 동의가 완료된 링크입니다.</p>
                <ul className="mt-2 space-y-1 text-emerald-800">
                  <li>회사명: {session.companyName}</li>
                  <li>동의자: {session.signerName}</li>
                  <li>체결일: {formatKst(session.agreedAt)}</li>
                </ul>
              </section>
            ) : (
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">동의자 정보</h3>
                <label className="block text-xs text-gray-600">
                  회사명 <span className="text-red-600">*</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="예: ○○클린"
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  이름 <span className="text-red-600">*</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  직책 <span className="text-red-600">*</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    value={signerTitle}
                    onChange={(e) => setSignerTitle(e.target.value)}
                    placeholder="예: 대표, 실장"
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  이메일 (선택)
                  <input
                    type="email"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  연락처 (선택)
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    value={signerPhone}
                    onChange={(e) => setSignerPhone(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  청소비서 업체코드 (선택)
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    placeholder="예: cbiseo"
                  />
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-800 pt-1">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <span>
                    위 약관·계약 내용을 확인하였으며, 이에 동의합니다. <span className="text-red-600">(필수)</span>
                  </span>
                </label>
                {msg ? (
                  <p className={`text-sm ${msg.includes('완료') ? 'text-emerald-700' : 'text-red-600'}`}>
                    {msg}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submit()}
                  className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 touch-manipulation"
                >
                  {busy ? '제출 중…' : '동의하고 제출'}
                </button>
              </section>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
