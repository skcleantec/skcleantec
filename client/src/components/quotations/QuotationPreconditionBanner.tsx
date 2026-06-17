import { Link } from 'react-router-dom';

type Props = {
  companyNameMissing: boolean;
  smtpReady: boolean;
  globalSmtpFallback: boolean;
};

export function QuotationPreconditionBanner({
  companyNameMissing,
  smtpReady,
  globalSmtpFallback,
}: Props) {
  if (!companyNameMissing && (smtpReady || globalSmtpFallback)) return null;

  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-fluid-sm text-amber-950 space-y-1.5">
      {companyNameMissing && (
        <p>
          PDF 상단에 표시할 <strong>상호(업체명)</strong>이 없습니다.{' '}
          <Link
            to="/admin/team-leaders/company-profile"
            className="font-medium text-amber-900 underline underline-offset-2 hover:no-underline"
          >
            업체등록정보
          </Link>
          에서 입력해 주세요.
        </p>
      )}
      {!smtpReady && !globalSmtpFallback && (
        <p>
          이메일 발송을 위해 SMTP 설정이 필요합니다.{' '}
          <Link
            to="/admin/team-leaders/company-profile"
            className="font-medium text-amber-900 underline underline-offset-2 hover:no-underline"
          >
            업체등록정보 → SMTP
          </Link>
          를 확인해 주세요. PDF 다운로드는 가능합니다.
        </p>
      )}
    </div>
  );
}
