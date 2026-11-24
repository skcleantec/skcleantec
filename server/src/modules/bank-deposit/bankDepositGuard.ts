/** 기기·업체 경계. 토큰 원문은 다루지 않는다. */

export function sameTenant(rowTenantId: string, actorTenantId: string): boolean {
  return rowTenantId === actorTenantId;
}

export function bankDepositFeatureDisabledBody() {
  return {
    error: '이 업체에서 사용하지 않는 기능입니다.',
    code: 'feature_disabled' as const,
    moduleId: 'mod_bank_deposit' as const,
  };
}

export function deviceCanIngest(device: { isActive: boolean; revokedAt: Date | null }): boolean {
  return device.isActive && device.revokedAt == null;
}

export type IngestSlot = 'stored' | 'duplicate' | 'skipped';

export function ingestSlot(parsed: boolean, alreadyStored: boolean): IngestSlot {
  if (!parsed) return 'skipped';
  if (alreadyStored) return 'duplicate';
  return 'stored';
}

const windows = new Map<string, { start: number; count: number }>();

export function resetDeviceRateForTests(): void {
  windows.clear();
}

/** 기기당 분당 60건. 넘치면 false. */
export function consumeDeviceRate(deviceId: string, add: number, now = Date.now()): boolean {
  const windowMs = 60_000;
  const limit = 60;
  if (add < 1) return true;
  const current = windows.get(deviceId);
  if (!current || now - current.start >= windowMs) {
    if (add > limit) return false;
    windows.set(deviceId, { start: now, count: add });
    return true;
  }
  if (current.count + add > limit) return false;
  current.count += add;
  return true;
}
