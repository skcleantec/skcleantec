import {
  getProfessionalOptionById,
  normalizeProfessionalOptionIds,
  type ProfessionalSpecialtyOption,
} from '../../constants/professionalSpecialtyOptions';

type Props = {
  rawIds: unknown;
  /** 관리자 스케줄용 — `/api/orderforms/professional-options/all` 결과 */
  catalog: ProfessionalSpecialtyOption[];
};

/** 스케줄 일정 제목 옆 — 선택된 전문 시공 옵션별 색 동그라미 */
export function ProfessionalOptionDots({ rawIds, catalog }: Props) {
  const ids = normalizeProfessionalOptionIds(rawIds, catalog);
  if (!ids.length) return null;
  return (
    <span className="inline-flex items-center gap-1 ml-1 align-middle" aria-label="전문 시공 옵션">
      {ids.map((id) => {
        const opt = getProfessionalOptionById(id, catalog);
        if (!opt) {
          return (
            <span
              key={id}
              title="삭제되었거나 알 수 없는 옵션"
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-gray-300 bg-gray-400"
            />
          );
        }
        return (
          <span
            key={id}
            title={`${opt.emoji ? `${opt.emoji} ` : ''}${opt.label}${opt.priceHint ? ` (${opt.priceHint})` : ''}`}
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-gray-300/80"
            style={{ backgroundColor: opt.color }}
          />
        );
      })}
    </span>
  );
}
