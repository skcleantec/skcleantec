import type { PublicOrderFormCompanyTrust } from '../../api/orderform';

type Props = {
  trust: PublicOrderFormCompanyTrust | null | undefined;
  displayNameFallback?: string | null;
};

function line(label: string, value: string | null | undefined) {
  if (!value?.trim()) return null;
  return (
    <p className="text-fluid-2xs text-gray-600">
      <span className="text-gray-500">{label}</span> {value.trim()}
    </p>
  );
}

/** 발주서 하단 — 업체 사업자 정보(보이스피싱 안심) */
export function OrderFormCompanyTrustFooter({ trust, displayNameFallback }: Props) {
  const companyName = trust?.companyName?.trim() || displayNameFallback?.trim();
  if (!companyName) return null;

  const hasDetail =
    trust?.representativeName ||
    trust?.businessRegistrationNo ||
    trust?.addressLine ||
    trust?.phone;

  return (
    <section
      className="mt-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-center"
      aria-label="업체 사업자 정보"
    >
      <p className="text-fluid-xs font-medium text-gray-800">{companyName}</p>
      {hasDetail ? (
        <div className="mt-1 space-y-0">
          {line('대표', trust?.representativeName)}
          {line('사업자등록번호', trust?.businessRegistrationNo)}
          {line('주소', trust?.addressLine)}
          {line('문의', trust?.phone)}
        </div>
      ) : null}
      <p className="mt-1.5 text-fluid-2xs leading-snug text-gray-500">
        위 업체 공식 발주서입니다. 연락처·상호가 다르면 등록된 번호로 확인해 주세요.
      </p>
    </section>
  );
}
