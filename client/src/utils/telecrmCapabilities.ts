import type { TelecrmUserCapabilities } from '@shared/telecrmTenantPolicy';

export function parseTelecrmCapabilitiesFromMe(raw: unknown): TelecrmUserCapabilities | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.licensed !== 'boolean' || typeof o.canAccess !== 'boolean') return null;
  const platforms = Array.isArray(o.platforms)
    ? o.platforms.filter((p): p is 'soomgo' | 'miso' => p === 'soomgo' || p === 'miso')
    : [];
  const seatsRaw = o.seats && typeof o.seats === 'object' ? (o.seats as Record<string, unknown>) : {};
  return {
    licensed: o.licensed,
    canAccess: o.canAccess,
    platforms,
    seats: {
      included: typeof seatsRaw.included === 'number' ? seatsRaw.included : 3,
      additional: typeof seatsRaw.additional === 'number' ? seatsRaw.additional : 0,
      max: typeof seatsRaw.max === 'number' ? seatsRaw.max : 3,
      assigned: typeof seatsRaw.assigned === 'number' ? seatsRaw.assigned : 0,
    },
    denyReason:
      o.denyReason === 'not_licensed' || o.denyReason === 'not_allowed' ? o.denyReason : null,
  };
}
