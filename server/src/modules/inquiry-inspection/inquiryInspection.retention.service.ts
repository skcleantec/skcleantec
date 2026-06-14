import { InquiryInspectionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';
import {
  INSPECTION_RETENTION_DAYS_DEFAULT,
  inspectionRetentionCutoffDate,
} from '../../lib/inquiryInspectionRetention.js';

export type InspectionRetentionPurgeResult = {
  scanned: number;
  purged: number;
  cloudinaryDeleted: number;
  cloudinaryFailed: number;
  errors: Array<{ checklistId: string; tenantId: string; message: string }>;
  cutoffIso: string;
  retentionDays: number;
};

async function destroyCloudinaryAsset(
  publicId: string,
  resourceType: 'image' | 'raw',
): Promise<boolean> {
  if (!isCloudinaryConfigured()) return false;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return true;
  } catch {
    return false;
  }
}

export async function purgeExpiredInspectionChecklists(options?: {
  retentionDays?: number;
  batchSize?: number;
  dryRun?: boolean;
}): Promise<InspectionRetentionPurgeResult> {
  const retentionDays =
    options?.retentionDays ??
    (Number.parseInt(process.env.INSPECTION_RETENTION_DAYS ?? '', 10) ||
      INSPECTION_RETENTION_DAYS_DEFAULT);
  const batchSize =
    options?.batchSize ??
    (Number.parseInt(process.env.INSPECTION_RETENTION_BATCH_SIZE ?? '', 10) || 40);
  const dryRun = options?.dryRun ?? false;
  const cutoff = inspectionRetentionCutoffDate(retentionDays);

  const candidates = await prisma.inquiryInspectionChecklist.findMany({
    where: {
      status: InquiryInspectionStatus.COMPLETED,
      completedAt: { not: null, lte: cutoff },
    },
    orderBy: { completedAt: 'asc' },
    take: Math.max(1, Math.min(200, batchSize)),
    select: {
      id: true,
      tenantId: true,
      inquiryId: true,
      completedAt: true,
      signaturePublicId: true,
      completionPdfPublicId: true,
    },
  });

  const result: InspectionRetentionPurgeResult = {
    scanned: candidates.length,
    purged: 0,
    cloudinaryDeleted: 0,
    cloudinaryFailed: 0,
    errors: [],
    cutoffIso: cutoff.toISOString(),
    retentionDays,
  };

  if (dryRun || candidates.length === 0) {
    return result;
  }

  for (const row of candidates) {
    try {
      const full = await prisma.inquiryInspectionChecklist.findFirst({
        where: { id: row.id, tenantId: row.tenantId },
        include: {
          areas: {
            include: {
              items: {
                include: { photos: { select: { cloudinaryPublicId: true } } },
              },
            },
          },
        },
      });
      if (!full) continue;

      const photoIds: string[] = [];
      for (const area of full.areas) {
        for (const item of area.items) {
          for (const photo of item.photos) {
            if (photo.cloudinaryPublicId?.trim()) photoIds.push(photo.cloudinaryPublicId.trim());
          }
        }
      }

      for (const publicId of photoIds) {
        const ok = await destroyCloudinaryAsset(publicId, 'image');
        if (ok) result.cloudinaryDeleted += 1;
        else result.cloudinaryFailed += 1;
      }

      if (full.signaturePublicId?.trim()) {
        const ok = await destroyCloudinaryAsset(full.signaturePublicId.trim(), 'image');
        if (ok) result.cloudinaryDeleted += 1;
        else result.cloudinaryFailed += 1;
      }

      if (full.completionPdfPublicId?.trim()) {
        const ok = await destroyCloudinaryAsset(full.completionPdfPublicId.trim(), 'raw');
        if (ok) result.cloudinaryDeleted += 1;
        else result.cloudinaryFailed += 1;
      }

      await prisma.inquiryInspectionChecklist.delete({
        where: { id: full.id },
      });
      result.purged += 1;
    } catch (e) {
      result.errors.push({
        checklistId: row.id,
        tenantId: row.tenantId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}

export function parseInspectionRetentionOptionsFromEnv(): {
  retentionDays: number;
  batchSize: number;
  cronEnabled: boolean;
  cronSecretConfigured: boolean;
} {
  const retentionDays =
    Number.parseInt(process.env.INSPECTION_RETENTION_DAYS ?? '', 10) ||
    INSPECTION_RETENTION_DAYS_DEFAULT;
  const batchSize =
    Number.parseInt(process.env.INSPECTION_RETENTION_BATCH_SIZE ?? '', 10) || 40;
  return {
    retentionDays,
    batchSize,
    cronEnabled: process.env.INSPECTION_RETENTION_CRON_ENABLED === 'true',
    cronSecretConfigured: Boolean(process.env.INSPECTION_RETENTION_CRON_SECRET?.trim()),
  };
}
