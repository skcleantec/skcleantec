import {
  formatBizNumberDisplay,
  signupBusinessTypeLabel,
  type SignupBusinessType,
} from '@shared/authSignup';
import type { TenantSignupAuthCategory } from '@shared/tenantSignupAuthMethod';
import type { PlatformTenantSignupBusiness } from '../../api/platformTenants';
import { ImageThumbLightbox } from '../ui/ImageThumbLightbox';
import { CARD_SECTION, SignupAuthMethodBadge } from '../../utils/platformUi';

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  const text = value?.trim() || '—';
  return (
    <div>
      <dt className="text-[11px] font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900 break-words">{text}</dd>
    </div>
  );
}

export function PlatformTenantSignupBusinessSection({
  signupBusiness,
  signupAuthLabel,
  signupAuthCategory,
}: {
  signupBusiness: PlatformTenantSignupBusiness | null | undefined;
  signupAuthLabel?: string;
  signupAuthCategory?: TenantSignupAuthCategory;
}) {
  return (
    <section className={CARD_SECTION}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">가입 사업자 정보</h2>
          <p className="mt-1 text-xs text-gray-500">
            셀프 가입 시 제출한 사업자·담당자 정보입니다. 세금계산서·청구 연동 시 참고합니다.
          </p>
          {signupAuthLabel && signupAuthCategory ? (
            <div className="mt-2">
              <SignupAuthMethodBadge label={signupAuthLabel} category={signupAuthCategory} />
            </div>
          ) : null}
        </div>
        {signupBusiness ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
            {signupBusinessTypeLabel(signupBusiness.businessType as SignupBusinessType)}
          </span>
        ) : null}
      </div>

      {!signupBusiness ? (
        <p className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-600">
          플랫폼에서 직접 개설한 업체이거나, 셀프 가입 이전에 만들어진 업체입니다. 사업자 스냅샷이
          없습니다.
        </p>
      ) : (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="담당자 이메일" value={signupBusiness.contactEmail} />
          <Field label="담당자 휴대폰" value={signupBusiness.contactPhone} />
          <Field
            label="제출 시각"
            value={new Date(signupBusiness.submittedAt).toLocaleString('ko-KR', {
              timeZone: 'Asia/Seoul',
            })}
          />

          {signupBusiness.businessType === 'registered_business' ? (
            <>
              <Field
                label="사업자등록번호"
                value={formatBizNumberDisplay(signupBusiness.bizNumber)}
              />
              <Field label="상호(사업자명)" value={signupBusiness.businessName} />
              <Field label="대표자명" value={signupBusiness.representativeName} />
              <Field label="사업장 주소" value={signupBusiness.addressLine} />
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-medium text-gray-500">사업자등록증</dt>
                <dd className="mt-1">
                  {signupBusiness.businessRegistrationImageUrl ? (
                    <ImageThumbLightbox
                      src={signupBusiness.businessRegistrationImageUrl}
                      alt="사업자등록증"
                      thumbClassName="h-24 w-auto max-w-full rounded-lg border border-gray-200 object-contain"
                    />
                  ) : (
                    <span className="text-sm text-gray-500">—</span>
                  )}
                </dd>
              </div>
            </>
          ) : (
            <>
              <Field
                label="비사업자 확인"
                value={
                  signupBusiness.individualConfirmedAt
                    ? new Date(signupBusiness.individualConfirmedAt).toLocaleString('ko-KR', {
                        timeZone: 'Asia/Seoul',
                      })
                    : null
                }
              />
              <Field label="이용 형태" value={signupBusiness.individualUsageNote} />
            </>
          )}
        </dl>
      )}
    </section>
  );
}
