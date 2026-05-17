import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getEContractIssuerProfile,
  patchEContractIssuerProfile,
  uploadEContractIssuerSeal,
  type EContractIssuerProfileDto,
  type EContractIssuerPlaceholder,
} from '../../api/adminEContract';
import { getToken } from '../../stores/auth';
import { EC_ISSUER_PLACEHOLDER_OPTIONS } from '../../utils/eContractIssuerPlaceholders';

type StampKind = 'SEAL' | 'SIGNATURE';

function parseWidthPx(raw: string): number | null | 'bad' {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  if (Number.isNaN(n) || n < 48 || n > 320) return 'bad';
  return n;
}

export function AdminEContractIssuerProfilePage() {
  const token = getToken();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [placeholders, setPlaceholders] = useState<EContractIssuerPlaceholder[]>([]);

  const [companyName, setCompanyName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [businessRegistrationNo, setBusinessRegistrationNo] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [phone, setPhone] = useState('');
  const [fax, setFax] = useState('');
  const [email, setEmail] = useState('');
  const [issuerStampKind, setIssuerStampKind] = useState<StampKind>('SEAL');
  const [sealDisplayWidthPx, setSealDisplayWidthPx] = useState<string>('96');
  const [sealPreviewUrl, setSealPreviewUrl] = useState<string | null>(null);
  const [signatureDisplayWidthPx, setSignatureDisplayWidthPx] = useState<string>('96');
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);

  const hydrate = useCallback((p: EContractIssuerProfileDto) => {
    setCompanyName(p.companyName);
    setRepresentativeName(p.representativeName ?? '');
    setBusinessRegistrationNo(p.businessRegistrationNo ?? '');
    setAddressLine(p.addressLine ?? '');
    setPhone(p.phone ?? '');
    setFax(p.fax ?? '');
    setEmail(p.email ?? '');
    setIssuerStampKind(p.issuerStampKind === 'SIGNATURE' ? 'SIGNATURE' : 'SEAL');
    setSealDisplayWidthPx(String(p.sealDisplayWidthPx ?? 96));
    setSealPreviewUrl(p.sealSecureUrl);
    setSignatureDisplayWidthPx(String(p.signatureDisplayWidthPx ?? 96));
    setSignaturePreviewUrl(p.signatureSecureUrl);
  }, []);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const payload = await getEContractIssuerProfile(token);
      setPlaceholders(payload.placeholders?.length ? payload.placeholders : [...EC_ISSUER_PLACEHOLDER_OPTIONS]);
      hydrate(payload.profile);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, hydrate]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saveText = async () => {
    if (!token) return;
    const sealW = parseWidthPx(sealDisplayWidthPx);
    const sigW = parseWidthPx(signatureDisplayWidthPx);
    if (sealW === 'bad') {
      setErr('도장 표시 너비는 48~320 또는 비움만 가능합니다.');
      return;
    }
    if (sigW === 'bad') {
      setErr('서명 표시 너비는 48~320 또는 비움만 가능합니다.');
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const { profile } = await patchEContractIssuerProfile(token, {
        companyName,
        representativeName: representativeName.trim() || null,
        businessRegistrationNo: businessRegistrationNo.trim() || null,
        addressLine: addressLine.trim() || null,
        phone: phone.trim() || null,
        fax: fax.trim() || null,
        email: email.trim() || null,
        issuerStampKind,
        sealDisplayWidthPx: sealW,
        signatureDisplayWidthPx: sigW,
      });
      hydrate(profile);
      setMsg('저장했습니다.');
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const saveWidthsOnly = async () => {
    if (!token) return;
    const sealW = parseWidthPx(sealDisplayWidthPx);
    const sigW = parseWidthPx(signatureDisplayWidthPx);
    if (sealW === 'bad' || sigW === 'bad') {
      setErr('표시 너비는 각각 48~320 또는 비움만 가능합니다.');
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const { profile } = await patchEContractIssuerProfile(token, {
        sealDisplayWidthPx: sealW,
        signatureDisplayWidthPx: sigW,
      });
      hydrate(profile);
      setMsg('표시 너비를 저장했습니다.');
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const saveStampKind = async (kind: StampKind) => {
    if (!token || kind === issuerStampKind) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const { profile } = await patchEContractIssuerProfile(token, { issuerStampKind: kind });
      hydrate(profile);
      setMsg(kind === 'SEAL' ? '계약서에는 도장 이미지가 표시됩니다.' : '계약서에는 서명 이미지가 표시됩니다.');
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const uploadSealFile = async (files: FileList | null) => {
    const f = files?.[0];
    if (!token || !f) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const up = await uploadEContractIssuerSeal(f, token, f.name || `seal_${Date.now()}.png`);
      await patchEContractIssuerProfile(token, {
        sealPublicId: up.publicId,
        sealSecureUrl: up.secureUrl,
      });
      setSealPreviewUrl(up.secureUrl);
      setMsg('도장 이미지를 저장했습니다.');
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '업로드하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const uploadSignatureFile = async (files: FileList | null) => {
    const f = files?.[0];
    if (!token || !f) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const up = await uploadEContractIssuerSeal(f, token, f.name || `issuer_sig_${Date.now()}.png`);
      await patchEContractIssuerProfile(token, {
        signaturePublicId: up.publicId,
        signatureSecureUrl: up.secureUrl,
      });
      setSignaturePreviewUrl(up.secureUrl);
      setMsg('서명 이미지를 저장했습니다.');
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '업로드하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const clearSeal = async () => {
    if (!token || !window.confirm('도장 이미지를 제거할까요?')) return;
    setBusy(true);
    setErr(null);
    try {
      await patchEContractIssuerProfile(token, { clearSeal: true });
      setSealPreviewUrl(null);
      setMsg('도장을 제거했습니다.');
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const clearSignature = async () => {
    if (!token || !window.confirm('서명 이미지를 제거할까요?')) return;
    setBusy(true);
    setErr(null);
    try {
      await patchEContractIssuerProfile(token, { clearSignature: true });
      setSignaturePreviewUrl(null);
      setMsg('서명 이미지를 제거했습니다.');
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return <p className="p-4 text-fluid-sm text-gray-600">로그인이 필요합니다.</p>;
  }

  if (loading) {
    return <p className="p-8 text-center text-fluid-sm text-gray-500">불러오는 중…</p>;
  }

  return (
    <div className="min-w-0 w-full max-w-full pb-12">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-fluid-lg font-semibold text-gray-900">전자계약 — 발행측(갑) 정보</h1>
          <p className="mt-1 text-fluid-xs text-gray-600">
            계약 본문에서 <code className="rounded bg-gray-100 px-1 py-0.5 text-fluid-2xs">[[EC_ISSUER_*]]</code> 토큰으로 삽입합니다.
            배포 시 이 화면의 값이 해당 버전에 스냅샷 저장됩니다.
          </p>
        </div>
        <Link
          to="/admin/team-leaders/e-contracts"
          className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-fluid-xs text-gray-800"
        >
          계약 목록으로
        </Link>
      </div>

      {err ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-900">{err}</div>
      ) : null}
      {msg ? (
        <div className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-fluid-xs text-green-900">{msg}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-fluid-sm font-semibold text-gray-900">법적 표시</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-fluid-2xs font-medium text-gray-700">상호(필수)</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
                autoComplete="organization"
              />
            </div>
            <div>
              <label className="block text-fluid-2xs font-medium text-gray-700">대표자</label>
              <input
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
              />
            </div>
            <div>
              <label className="block text-fluid-2xs font-medium text-gray-700">사업자등록번호</label>
              <input
                value={businessRegistrationNo}
                onChange={(e) => setBusinessRegistrationNo(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm tabular-nums"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-fluid-2xs font-medium text-gray-700">주소</label>
              <textarea
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-fluid-2xs font-medium text-gray-700">전화</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
                />
              </div>
              <div>
                <label className="block text-fluid-2xs font-medium text-gray-700">팩스</label>
                <input
                  value={fax}
                  onChange={(e) => setFax(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-fluid-2xs font-medium text-gray-700">이메일</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveText()}
            className="mt-6 w-full rounded-lg bg-gray-900 py-3 text-fluid-sm font-medium text-white disabled:opacity-50 lg:w-auto lg:px-8"
          >
            텍스트 필드 저장
          </button>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-fluid-sm font-semibold text-gray-900">갑 (인) — 도장 또는 서명</h2>
          <p className="mt-1 text-fluid-2xs text-gray-600">
            동일 토큰 <code className="rounded bg-gray-100 px-1">[[EC_ISSUER_SEAL]]</code> 로 계약서·부록에 들어갑니다. 아래에서 표시 방식만
            선택하면 됩니다.
          </p>

          <div className="mt-4 flex flex-wrap gap-4">
            <label className="inline-flex cursor-pointer items-center gap-2 text-fluid-xs text-gray-800">
              <input
                type="radio"
                name="issuer-stamp-kind"
                checked={issuerStampKind === 'SEAL'}
                disabled={busy}
                onChange={() => void saveStampKind('SEAL')}
                className="h-4 w-4"
              />
              도장 이미지
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-fluid-xs text-gray-800">
              <input
                type="radio"
                name="issuer-stamp-kind"
                checked={issuerStampKind === 'SIGNATURE'}
                disabled={busy}
                onChange={() => void saveStampKind('SIGNATURE')}
                className="h-4 w-4"
              />
              서명 이미지
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
            <div className={issuerStampKind === 'SEAL' ? '' : 'opacity-50'}>
              <div className="text-fluid-2xs font-semibold text-gray-800">도장</div>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-fluid-2xs text-gray-600">너비(px)</label>
                  <input
                    type="number"
                    min={48}
                    max={320}
                    value={sealDisplayWidthPx}
                    onChange={(e) => setSealDisplayWidthPx(e.target.value)}
                    disabled={busy || issuerStampKind !== 'SEAL'}
                    className="mt-0.5 w-24 rounded-md border border-gray-300 px-2 py-1.5 text-fluid-xs tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  disabled={busy || issuerStampKind !== 'SEAL'}
                  onClick={() => document.getElementById('issuer-seal-file')?.click()}
                  className="rounded-md bg-blue-700 px-3 py-1.5 text-fluid-2xs font-medium text-white disabled:opacity-50"
                >
                  업로드
                </button>
                <input
                  id="issuer-seal-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => void uploadSealFile(e.target.files)}
                />
                <button
                  type="button"
                  disabled={busy || issuerStampKind !== 'SEAL'}
                  onClick={() => void clearSeal()}
                  className="text-fluid-2xs text-red-700 underline disabled:opacity-50"
                >
                  제거
                </button>
              </div>
              <div className="mt-2 rounded border border-dashed border-gray-200 bg-gray-50 p-3 text-center">
                {sealPreviewUrl ? (
                  <img
                    src={sealPreviewUrl}
                    alt="도장"
                    className="mx-auto max-h-36 max-w-full object-contain"
                    width={Number(sealDisplayWidthPx) > 0 ? Number(sealDisplayWidthPx) : 96}
                  />
                ) : (
                  <span className="text-fluid-2xs text-gray-500">미등록</span>
                )}
              </div>
            </div>

            <div className={issuerStampKind === 'SIGNATURE' ? '' : 'opacity-50'}>
              <div className="text-fluid-2xs font-semibold text-gray-800">서명</div>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-fluid-2xs text-gray-600">너비(px)</label>
                  <input
                    type="number"
                    min={48}
                    max={320}
                    value={signatureDisplayWidthPx}
                    onChange={(e) => setSignatureDisplayWidthPx(e.target.value)}
                    disabled={busy || issuerStampKind !== 'SIGNATURE'}
                    className="mt-0.5 w-24 rounded-md border border-gray-300 px-2 py-1.5 text-fluid-xs tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  disabled={busy || issuerStampKind !== 'SIGNATURE'}
                  onClick={() => document.getElementById('issuer-signature-file')?.click()}
                  className="rounded-md bg-blue-700 px-3 py-1.5 text-fluid-2xs font-medium text-white disabled:opacity-50"
                >
                  업로드
                </button>
                <input
                  id="issuer-signature-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => void uploadSignatureFile(e.target.files)}
                />
                <button
                  type="button"
                  disabled={busy || issuerStampKind !== 'SIGNATURE'}
                  onClick={() => void clearSignature()}
                  className="text-fluid-2xs text-red-700 underline disabled:opacity-50"
                >
                  제거
                </button>
              </div>
              <div className="mt-2 rounded border border-dashed border-gray-200 bg-gray-50 p-3 text-center">
                {signaturePreviewUrl ? (
                  <img
                    src={signaturePreviewUrl}
                    alt="서명"
                    className="mx-auto max-h-36 max-w-full object-contain"
                    width={Number(signatureDisplayWidthPx) > 0 ? Number(signatureDisplayWidthPx) : 96}
                  />
                ) : (
                  <span className="text-fluid-2xs text-gray-500">미등록</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void saveWidthsOnly()}
            className="mt-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-fluid-xs text-gray-900 disabled:opacity-50"
          >
            도장·서명 표시 너비만 저장
          </button>
        </div>
      </div>

      <details className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer text-fluid-sm font-medium text-gray-800">본문 삽입 토큰 목록</summary>
        <ul className="mt-3 list-inside list-disc space-y-1 text-fluid-xs text-gray-700">
          {placeholders.map((p) => (
            <li key={p.token}>
              <span className="font-medium">{p.label}</span> — <code className="rounded bg-gray-50 px-1">{p.token}</code>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
