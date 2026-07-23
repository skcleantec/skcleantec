import type { PlatformPromoOrderMode, PlatformPromoOrderModeOverride, PlatformPartnerPromo } from '@prisma/client';
import type { PlatformPromoAudience } from './platformPartnerPromo.helpers.js';

export type PromoOrderRow = Pick<PlatformPartnerPromo, 'id' | 'sortOrder' | 'orderModeOverride'>;

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function effectiveOrderMode(
  override: PlatformPromoOrderModeOverride,
  audienceMode: PlatformPromoOrderMode,
): PlatformPromoOrderMode {
  return override === 'INHERIT' ? audienceMode : override;
}

/** sortOrder 기준 정렬 후 고정·랜덤 혼합 슬롯 배치 */
export function applyPromoDisplayOrder<T extends PromoOrderRow>(
  rows: T[],
  audienceMode: PlatformPromoOrderMode,
): T[] {
  if (rows.length <= 1) return rows;

  const sorted = [...rows].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );

  const modes = sorted.map((row) =>
    effectiveOrderMode(row.orderModeOverride, audienceMode),
  );

  if (modes.every((m) => m === 'FIXED')) return sorted;
  if (modes.every((m) => m === 'RANDOM')) return shuffleInPlace([...sorted]);

  const rankById = new Map(sorted.map((row, index) => [row.id, index]));
  const result: (T | undefined)[] = new Array(sorted.length);

  const randomPool: T[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const row = sorted[i]!;
    if (modes[i] === 'FIXED') {
      result[rankById.get(row.id)!] = row;
    } else {
      randomPool.push(row);
    }
  }

  shuffleInPlace(randomPool);
  let randomIdx = 0;
  for (let i = 0; i < result.length; i += 1) {
    if (!result[i]) {
      result[i] = randomPool[randomIdx];
      randomIdx += 1;
    }
  }

  return result.filter((row): row is T => row != null);
}

export function audienceOrderMode(
  audience: PlatformPromoAudience,
  settings: {
    externalPartnerOrderMode: PlatformPromoOrderMode;
    tenantStaffOrderMode: PlatformPromoOrderMode;
  },
): PlatformPromoOrderMode {
  return audience === 'external_partner'
    ? settings.externalPartnerOrderMode
    : settings.tenantStaffOrderMode;
}
