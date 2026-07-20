import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  completeMyProfile,
  isAuthSessionExpiredError,
  type ExternalCompanyOnboarding,
} from '../../api/auth';
import { onboardingContactNameForForm } from '@shared/profileOnboarding';

export type ProfileOnboardingInitial = {
  role: string;
  name?: string | null;
  phone?: string | null;
  vehicleNumber?: string | null;
  nameEn?: string | null;
  externalCompany?: ExternalCompanyOnboarding | null;
};

export function ProfileOnboardingModal({
  open,
  token,
  initial,
  onCompleted,
  onSessionExpired,
}: {
  open: boolean;
  token: string;
  initial: ProfileOnboardingInitial;
  onCompleted: () => void;
  onSessionExpired?: () => void;
}) {
  const isTeamLeader = initial.role === 'TEAM_LEADER';
  const isMarketer = initial.role === 'MARKETER';
  const isExternalPartner = initial.role === 'EXTERNAL_PARTNER';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [bizNumber, setBizNumber] = useState('');
  const [memo, setMemo] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(onboardingContactNameForForm(initial.name));
    setPhone((initial.phone ?? '').trim());
    setVehicleNumber((initial.vehicleNumber ?? '').trim());
    setNameEn((initial.nameEn ?? '').trim());
    const ec = initial.externalCompany;
    setCompanyName((ec?.name ?? '').trim());
    setCompanyPhone((ec?.phone ?? '').trim());
    setBizNumber((ec?.bizNumber ?? '').trim());
    setMemo((ec?.memo ?? '').trim());
    setExistingImageUrl(ec?.businessRegistrationImageUrl ?? null);
    setImageFile(null);
    setImagePreview(null);
    setError(null);
  }, [open, initial]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const title = useMemo(() => {
    if (isExternalPartner) return '타업체 정보 입력';
    if (isTeamLeader) return '팀장 정보 입력';
    if (isMarketer) return '마케터 정보 입력';
    return '본인 정보 입력';
  }, [isExternalPartner, isTeamLeader, isMarketer]);

  const onPickImage = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      return;
    }
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setError('PDF 파일은 업로드할 수 없습니다. JPG·PNG 등 이미지 파일만 선택해 주세요.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    setError(null);
    setImageFile(file);
  };

  const submit = async () => {
    setError(null);
    if (isExternalPartner && !imageFile && !existingImageUrl) {
      setError('사업자등록증 이미지를 등록해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        ...(isTeamLeader
          ? { vehicleNumber: vehicleNumber.trim(), nameEn: nameEn.trim() }
          : {}),
        ...(isExternalPartner
          ? {
              companyName: companyName.trim(),
              companyPhone: companyPhone.trim(),
              bizNumber: bizNumber.trim(),
              memo: memo.trim(),
              businessRegistrationImage: imageFile,
            }
          : {}),
      };
      await completeMyProfile(token, payload);
      onCompleted();
    } catch (e) {
      if (isAuthSessionExpiredError(e)) {
        onSessionExpired?.();
        return;
      }
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const previewSrc = imagePreview ?? existingImageUrl;

  return createPortal(
    <div
      className="fixed inset-0 z-[700] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="profile-onboarding-title"
    >
      <div className="flex max-h-[min(94dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="shrink-0 border-b border-gray-200 px-4 py-4 sm:px-5">
          <h2 id="profile-onboarding-title" className="text-fluid-base font-semibold text-gray-900">
            {title}
          </h2>
          <p className="mt-1 text-fluid-xs leading-relaxed text-gray-600">
            처음 로그인하셨습니다. 아래 정보를 입력해야 청소비서를 이용할 수 있습니다.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-5">
          {error ? (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">
              {error}
            </div>
          ) : null}

          <div className="space-y-4">
            {isExternalPartner ? (
              <section className="space-y-3 rounded-xl border border-gray-200 bg-slate-50/60 p-3">
                <h3 className="text-fluid-xs font-semibold text-slate-700">사업체 정보</h3>
                <label className="block">
                  <span className="mb-1 block text-fluid-xs text-gray-600">업체명 *</span>
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-fluid-xs text-gray-600">사업자등록번호 *</span>
                  <input
                    value={bizNumber}
                    onChange={(e) => setBizNumber(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-fluid-xs text-gray-600">대표 연락처 *</span>
                  <input
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-fluid-xs text-gray-600">메모 (선택)</span>
                  <textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
                  />
                </label>
              </section>
            ) : null}

            <section className="space-y-3 rounded-xl border border-gray-200 p-3">
              <h3 className="text-fluid-xs font-semibold text-slate-700">
                {isExternalPartner ? '담당자 정보' : '본인 정보'}
              </h3>
              <label className="block">
                <span className="mb-1 block text-fluid-xs text-gray-600">
                  {isExternalPartner ? '담당자 이름 *' : '이름 *'}
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-fluid-xs text-gray-600">
                  {isExternalPartner ? '담당자 연락처 *' : '연락처 *'}
                </span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
                  required
                />
              </label>
              {isTeamLeader ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-fluid-xs text-gray-600">차량번호 *</span>
                    <input
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-fluid-xs text-gray-600">영문 이름 *</span>
                    <input
                      value={nameEn}
                      onChange={(e) => setNameEn(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
                      required
                    />
                  </label>
                </>
              ) : null}
            </section>

            {isExternalPartner ? (
              <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <h3 className="text-fluid-xs font-semibold text-amber-900">사업자등록증 *</h3>
                <p className="text-fluid-2xs leading-relaxed text-amber-900/90">
                  JPG·PNG·WEBP 등 <strong>이미지 파일만</strong> 등록할 수 있습니다.{' '}
                  <strong>PDF 파일은 업로드할 수 없습니다.</strong>
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                  className="block w-full text-fluid-xs text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-fluid-xs file:font-medium file:text-white"
                />
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt="사업자등록증 미리보기"
                    className="mt-2 max-h-48 w-full rounded-lg border border-gray-200 object-contain bg-white"
                  />
                ) : (
                  <p className="text-fluid-2xs text-gray-500">등록된 이미지가 없습니다.</p>
                )}
              </section>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-4 py-3 sm:px-5">
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-fluid-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? '저장 중…' : '저장하고 시작하기'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
