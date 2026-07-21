import type { TenantInquiryShareMeta } from '../../api/tenantInquiryShare';

type Props = {
  share: TenantInquiryShareMeta;
  className?: string;
  /** 타업체 접수상세 — 한 줄 안내 */
  compact?: boolean;
};

/** 수신 파트너 접수 상세 — 연계받음 안내 */
export function PartnerReceivedBanner({ share, className = '', compact = false }: Props) {
  if (share.role !== 'TARGET') return null;
  const revoked = share.syncStatus === 'REVOKED';
  const sourceNo = share.sourceInquiryNumberSnapshot?.trim();
  const title = revoked
    ? `원래 ${share.partnerName}에서 연계받았으나 취소되었습니다.`
    : sourceNo
      ? `원 접수번호: ${sourceNo}`
      : `${share.partnerName}에서 연계받은 접수입니다.`;

  if (compact) {
    return (
      <p
        className={`border-b border-gray-100 py-1 text-fluid-2xs leading-snug ${
          revoked ? 'text-gray-600' : 'text-gray-700'
        } ${className}`}
        title={title}
      >
        {revoked ? (
          <>연계 취소됨 · {share.partnerName}</>
        ) : (
          <>
            <span className="font-medium text-gray-800">{share.partnerName} 연계</span>
            {sourceNo ? <span className="ml-1 tabular-nums text-gray-500">({sourceNo})</span> : null}
            {share.viaMarketplace ? <span className="ml-1 text-gray-500">· 정보공유</span> : null}
          </>
        )}
      </p>
    );
  }

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        revoked
          ? 'border-gray-200 bg-gray-50'
          : 'border-sky-200 bg-sky-50/80'
      } ${className}`}
      title={title}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-lg px-3 py-1.5 text-fluid-xs font-semibold ${
            revoked
              ? 'bg-gray-200 text-gray-700 line-through decoration-gray-500'
              : 'bg-sky-600 text-white shadow-sm'
          }`}
        >
          {revoked ? '연계 취소됨' : `📥 ${share.partnerName}에서 연계받음`}
        </span>
        {!revoked && sourceNo ? (
          <span className="text-fluid-2xs text-sky-900/80 tabular-nums">
            원번호 {sourceNo}
          </span>
        ) : null}
        {share.viaMarketplace ? (
          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
            정보공유
          </span>
        ) : null}
      </div>
      {!revoked ? (
        <p className="mt-1.5 text-fluid-2xs leading-snug text-sky-900/85">
          다른 업체에서 넘겨받은 건입니다. 현장 배정·수금은 우리 업무 기준으로 진행하세요.
        </p>
      ) : (
        <p className="mt-1.5 text-fluid-2xs leading-snug text-gray-600">
          연계가 취소된 접수입니다. 목록에는 유지되며 일반 접수처럼 관리할 수 있습니다.
        </p>
      )}
    </div>
  );
}
