import { Link } from 'react-router-dom';

type Props = {
  companyNameMissing: boolean;
  smtpReady: boolean;
  globalSmtpFallback: boolean;
  /** team: 관리자 설정 링크 대신 안내 문구 */
  variant?: 'admin' | 'team';
};

export function QuotationPreconditionBanner({
  companyNameMissing,
  smtpReady,
  globalSmtpFallback,
  variant = 'admin',
}: Props) {
  if (!companyNameMissing && (smtpReady || globalSmtpFallback)) return null;

  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-fluid-sm text-amber-950 space-y-1.5">
      {companyNameMissing && (
        <p>
          PDF 공급자 <strong>상호</strong>가 없습니다.{' '}
          {variant === 'admin' ? (
            <>
              <Link
                to="/admin/team-leaders/operating-companies"
                className="font-medium text-amber-900 underline underline-offset-2 hover:no-underline"
              >
                영업 브랜드
              </Link>
              에서 사업자 정보를 입력하거나,{' '}
              <Link
                to="/admin/team-leaders/company-profile/business"
                className="font-medium text-amber-900 underline underline-offset-2 hover:no-underline"
              >
                업체 기본 사업자 정보
              </Link>
              를 설정해 주세요.
            </>
          ) : (
            <>관리자에게 영업 브랜드·사업자 정보 설정을 요청해 주세요.</>
          )}
        </p>
      )}
      {!smtpReady && !globalSmtpFallback && (
        <p>
          {variant === 'admin' ? (
            <>
              이메일 발송을 위해 SMTP 설정이 필요합니다.{' '}
              <Link
                to="/admin/team-leaders/company-profile/outbound-email"
                className="font-medium text-amber-900 underline underline-offset-2 hover:no-underline"
              >
                발송 이메일 설정
              </Link>
              을 확인해 주세요. PDF 다운로드는 가능합니다.
            </>
          ) : (
            <>
              이메일 발송을 위해 SMTP 설정이 필요합니다. 관리자에게 발송 이메일(SMTP) 설정을
              요청해 주세요. PDF 다운로드는 가능합니다.
            </>
          )}
        </p>
      )}
    </div>
  );
}
