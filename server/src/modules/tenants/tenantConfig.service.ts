import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import {
  mergeTenantConfig,
  parseTenantConfig,
  tenantConfigToJson,
  type TenantConfig,
} from './tenantConfig.schema.js';
import { TenantNotFoundError } from './tenant.service.js';

export async function getTenantConfig(tenantId: string): Promise<TenantConfig> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true },
  });
  if (!row) throw new TenantNotFoundError();
  return parseTenantConfig(row.config);
}

export async function updateTenantConfig(tenantId: string, patchRaw: unknown): Promise<TenantConfig> {
  const existing = await getTenantConfig(tenantId);
  const patch = parseTenantConfig(patchRaw);
  const merged = mergeTenantConfig(existing, patch);
  const json = tenantConfigToJson(merged);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { config: json as Prisma.InputJsonValue },
  });

  return merged;
}

export async function replaceTenantConfig(tenantId: string, configRaw: unknown): Promise<TenantConfig> {
  const parsed = parseTenantConfig(configRaw);
  const json = tenantConfigToJson(parsed);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { config: json as Prisma.InputJsonValue },
  });
  return parsed;
}
