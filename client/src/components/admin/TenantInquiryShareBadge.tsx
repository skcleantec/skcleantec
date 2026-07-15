import type { TenantInquiryShareMeta } from '../../api/tenantInquiryShare';

type Props = {
  share: TenantInquiryShareMeta;
  className?: string;
  /** 목록 등 좁은 공간 — 수신 시 원 접수번호 생략 */
  compact?: boolean;
};

export function TenantInquiryShareBadge({ share, className = '', compact = false }: Props) {
  const isSource = share.role === 'SOURCE';
  const revoked = share.syncStatus === 'REVOKED';
  const viaMarketplace = Boolean(share.viaMarketplace);
  const externalLegacy = share.settlementMode === 'EXTERNAL_LEGACY';
  const label = revoked
    ? '연계 취소됨'
    : isSource
      ? externalLegacy
        ? `🔗 ${share.partnerName} (타업체정산 유지)`
        : `🔗 ${share.partnerName}에 연계`
      : `📥 ${share.partnerName}에서 연계`;
  const sourceNo = share.sourceInquiryNumberSnapshot?.trim();
  const title = revoked
    ? '접수 연계가 취소되었습니다.'
    : isSource
    ? externalLegacy
      ? '타업체에서 정식 파트너로 이관된 접수입니다. DB는 파트너 mirror로 운영하고, 수수료 정산은 타업체 정산 메뉴를 그대로 사용합니다.'
      : viaMarketplace
      ? '정보공유(마켓) 확정 후 연계된 접수입니다. 수정 시 파트너 업체에도 반영됩니다.'
      : '수정 시 파트너 업체에도 반영됩니다(고객·일정·금액 등). 완료·취소는 양쪽 자동 반영됩니다.'
    : viaMarketplace
      ? '정보공유(마켓) 확정 후 연계받은 접수입니다.'
      : sourceNo
        ? `원 접수번호: ${sourceNo}`
        : undefined;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight sm:text-fluid-2xs ${
        revoked
          ? 'border-gray-300 bg-gray-100 text-gray-600 line-through decoration-gray-400'
          : isSource
          ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
          : 'border-sky-200 bg-sky-50 text-sky-900'
      } ${className}`}
      title={title}
    >
      <span className="truncate">{label}</span>
      {viaMarketplace ? (
        <span className="shrink-0 rounded bg-violet-100 px-1 text-[9px] font-semibold text-violet-800">
          정보공유
        </span>
      ) : null}
      {!isSource && sourceNo && !compact ? (
        <span className="shrink-0 tabular-nums text-gray-600">({sourceNo})</span>
      ) : null}
    </span>
  );
}
