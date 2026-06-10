import type { TenantInquiryShareMeta } from '../../api/tenantInquiryShare';

type Props = {
  share: TenantInquiryShareMeta;
  className?: string;
  /** 목록 등 좁은 공간 — 수신 시 원 접수번호 생략 */
  compact?: boolean;
};

export function TenantInquiryShareBadge({ share, className = '', compact = false }: Props) {
  const isSource = share.role === 'SOURCE';
  const label = isSource
    ? `🔗 ${share.partnerName}에 전달`
    : `📥 ${share.partnerName}에서 수신`;
  const sourceNo = share.sourceInquiryNumberSnapshot?.trim();
  const title = isSource
    ? '수정 시 상대 전산에도 반영됩니다(고객·일정·금액 등). 완료·취소는 양쪽 자동 반영됩니다.'
    : sourceNo
      ? `원 접수번호: ${sourceNo}`
      : undefined;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight sm:text-fluid-2xs ${
        isSource
          ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
          : 'border-sky-200 bg-sky-50 text-sky-900'
      } ${className}`}
      title={title}
    >
      <span className="truncate">{label}</span>
      {!isSource && sourceNo && !compact ? (
        <span className="shrink-0 tabular-nums text-gray-600">({sourceNo})</span>
      ) : null}
    </span>
  );
}
