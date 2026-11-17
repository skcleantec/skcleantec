/** 숨고 자동메시지 — 브랜드 행만 사용. 업체 공통(operatingCompanyId null)은 보내지 않는다. */

export type SoomgoPresetBrandRow = {
  id: string;
  tenantId: string;
  ownerUserId: string | null;
  operatingCompanyId: string | null;
  triggerKind: string;
  stepsJson: string;
  isActive: boolean;
  paybackWon: number | null;
  label: string;
};

export function presetStepCount(stepsJson: string | null | undefined): number {
  if (!stepsJson) return 0;
  try {
    const parsed = JSON.parse(stepsJson) as unknown;
    if (!Array.isArray(parsed)) return 0;
    return parsed.filter((step) => {
      if (!step || typeof step !== 'object') return false;
      const row = step as { type?: string; text?: string; urls?: unknown };
      if (row.type === 'text') return typeof row.text === 'string' && row.text.trim().length > 0;
      if (row.type === 'images') return Array.isArray(row.urls) && row.urls.length > 0;
      return false;
    }).length;
  } catch {
    return 0;
  }
}

/** 단계 0개이면서 꺼져 있으면 비어 있음 — 공통 내용을 복사할 수 있다 */
export function isEmptyInactivePreset(row: { stepsJson: string | null; isActive: boolean }): boolean {
  return row.isActive !== true && presetStepCount(row.stepsJson) === 0;
}

export function findBrandPreset(
  rows: SoomgoPresetBrandRow[],
  query: {
    tenantId: string;
    triggerKind: string;
    operatingCompanyId: string | null;
    ownerUserId: string | null;
  },
): SoomgoPresetBrandRow | null {
  if (!query.operatingCompanyId) return null;
  return (
    rows.find(
      (row) =>
        row.tenantId === query.tenantId &&
        row.triggerKind === query.triggerKind &&
        row.operatingCompanyId === query.operatingCompanyId &&
        (row.ownerUserId ?? null) === (query.ownerUserId ?? null),
    ) ?? null
  );
}

/** 활성 + 단계가 있는 브랜드 행만 발송. 공통 행은 여기서 고르지 않는다. */
export function presetForSend(row: SoomgoPresetBrandRow | null): SoomgoPresetBrandRow | null {
  if (!row?.operatingCompanyId) return null;
  if (!row.isActive || presetStepCount(row.stepsJson) === 0) return null;
  return row;
}

/**
 * 업체 공통(null) 행을 브랜드마다 복사.
 * 같은 키의 브랜드 행이 없거나, 비어 있을 때만 내용·활성·페이백을 옮긴다.
 * 공통 행은 지우지 않는다.
 */
export function applyCommonCopy(rows: SoomgoPresetBrandRow[], brandIds: string[]): SoomgoPresetBrandRow[] {
  const next = rows.map((row) => ({ ...row }));
  const commons = next.filter((row) => row.operatingCompanyId == null && row.triggerKind);
  for (const common of commons) {
    for (const brandId of brandIds) {
      const idx = next.findIndex(
        (row) =>
          row.tenantId === common.tenantId &&
          row.triggerKind === common.triggerKind &&
          row.operatingCompanyId === brandId &&
          (row.ownerUserId ?? null) === (common.ownerUserId ?? null),
      );
      if (idx < 0) {
        next.push({
          ...common,
          id: `${common.id}__${brandId}`,
          operatingCompanyId: brandId,
        });
        continue;
      }
      if (isEmptyInactivePreset(next[idx]!)) {
        next[idx] = {
          ...next[idx]!,
          label: common.label,
          stepsJson: common.stepsJson,
          isActive: common.isActive,
          paybackWon: common.paybackWon,
        };
      }
    }
  }
  return next;
}

export function saveBrandPreset(
  rows: SoomgoPresetBrandRow[],
  key: {
    tenantId: string;
    triggerKind: string;
    operatingCompanyId: string;
    ownerUserId: string | null;
    label: string;
  },
  patch: { stepsJson: string; isActive: boolean; paybackWon?: number | null },
): SoomgoPresetBrandRow[] {
  const next = rows.map((row) => ({ ...row }));
  const idx = next.findIndex(
    (row) =>
      row.tenantId === key.tenantId &&
      row.triggerKind === key.triggerKind &&
      row.operatingCompanyId === key.operatingCompanyId &&
      (row.ownerUserId ?? null) === (key.ownerUserId ?? null),
  );
  if (idx < 0) {
    next.push({
      id: `new-${key.triggerKind}-${key.operatingCompanyId}-${key.ownerUserId ?? 'shared'}`,
      tenantId: key.tenantId,
      ownerUserId: key.ownerUserId,
      operatingCompanyId: key.operatingCompanyId,
      triggerKind: key.triggerKind,
      label: key.label,
      stepsJson: patch.stepsJson,
      isActive: patch.isActive,
      paybackWon: patch.paybackWon ?? null,
    });
    return next;
  }
  next[idx] = {
    ...next[idx]!,
    label: key.label,
    stepsJson: patch.stepsJson,
    isActive: patch.isActive,
    ...(patch.paybackWon !== undefined ? { paybackWon: patch.paybackWon } : {}),
  };
  return next;
}

/** 발송 계정: 브랜드 숨고 계정이 있으면 그 계정, 없으면 업체 계정 */
export function pickSoomgoCredentialSource(
  brandReady: boolean,
  tenantReady: boolean,
): 'brand' | 'tenant' | null {
  if (brandReady) return 'brand';
  if (tenantReady) return 'tenant';
  return null;
}
