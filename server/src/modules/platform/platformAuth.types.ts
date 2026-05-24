import type { PlatformRole } from '@prisma/client';

export interface PlatformAuthPayload {
  kind: 'platform';
  platformUserId: string;
  email: string;
  role: PlatformRole;
}

export function isPlatformAuthPayload(payload: unknown): payload is PlatformAuthPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return p.kind === 'platform' && typeof p.platformUserId === 'string';
}
