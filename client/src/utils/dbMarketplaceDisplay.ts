import type { DbMarketplaceMaskedItem } from '../api/dbMarketplace';

export function formatMarketplacePreferredDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ko-KR');
}

/** 면적 — 공급/전용 + ㎡ 보조 */
export function formatMarketplaceArea(row: Pick<DbMarketplaceMaskedItem, 'areaPyeong' | 'areaBasis' | 'exclusiveAreaSqm'>): string {
  if (row.areaPyeong == null) return '';
  const basis = row.areaBasis?.trim();
  const pyeong = `${row.areaPyeong}평`;
  const basisLabel = basis === '공급' ? '공급' : basis === '전용' ? '전용' : basis || '';
  const sqm =
    row.exclusiveAreaSqm != null && Number.isFinite(row.exclusiveAreaSqm)
      ? ` · ${row.exclusiveAreaSqm}㎡`
      : '';
  return basisLabel ? `${basisLabel} ${pyeong}${sqm}` : `${pyeong}${sqm}`;
}

/** 방·욕실·베란다·주방 */
export function formatMarketplaceStructure(
  row: Pick<
    DbMarketplaceMaskedItem,
    'isOneRoom' | 'roomCount' | 'bathroomCount' | 'balconyCount' | 'kitchenCount'
  >,
): string {
  if (row.isOneRoom) return '원룸';
  const parts: string[] = [];
  if (row.roomCount != null) parts.push(`방 ${row.roomCount}`);
  if (row.bathroomCount != null) parts.push(`화 ${row.bathroomCount}`);
  if (row.balconyCount != null) parts.push(`베란다 ${row.balconyCount}`);
  if (row.kitchenCount != null) parts.push(`주방 ${row.kitchenCount}`);
  return parts.join(' · ');
}

/** 예약일·시간대 */
export function formatMarketplaceSchedule(
  row: Pick<
    DbMarketplaceMaskedItem,
    'preferredDate' | 'preferredTime' | 'preferredTimeDetail' | 'betweenScheduleSlot'
  >,
): string {
  const parts: string[] = [];
  const date = formatMarketplacePreferredDate(row.preferredDate);
  if (date !== '-') parts.push(date);
  if (row.preferredTime?.trim()) parts.push(row.preferredTime.trim());
  if (row.preferredTimeDetail?.trim()) parts.push(row.preferredTimeDetail.trim());
  if (row.betweenScheduleSlot?.trim()) parts.push(`사이청소 ${row.betweenScheduleSlot.trim()}`);
  return parts.join(' · ') || '-';
}

/** 목록·카드 한 줄 요약 */
export function formatMarketplaceCleaningSummary(row: DbMarketplaceMaskedItem): string {
  const parts: string[] = [];
  if (row.propertyType?.trim()) parts.push(row.propertyType.trim());
  if (row.buildingType?.trim()) parts.push(row.buildingType.trim());
  const area = formatMarketplaceArea(row);
  if (area) parts.push(area);
  const structure = formatMarketplaceStructure(row);
  if (structure) parts.push(structure);
  return parts.join(' · ') || '-';
}

/** 상세 — 라벨·값 행 */
export function marketplaceCleaningDetailRows(
  row: DbMarketplaceMaskedItem,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: string | null | undefined) => {
    const v = String(value ?? '').trim();
    if (v) rows.push({ label, value: v });
  };

  push('지역', row.addressRegion);
  push('건축물', row.propertyType);
  push('신축/구축', row.buildingType);
  push('면적', formatMarketplaceArea(row) || null);
  push('구조', formatMarketplaceStructure(row));
  push('일정', formatMarketplaceSchedule(row));
  if (row.moveInDateUndecided) {
    rows.push({ label: '이사일', value: '미정' });
  } else if (row.moveInDate) {
    push('이사일', formatMarketplacePreferredDate(row.moveInDate));
  }
  push('접수 경로', row.source);
  push('특이사항', row.specialNotes);
  push('메모', row.memo);
  push('스케줄 메모', row.scheduleMemo);

  return rows;
}
