import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { destroyStoredObject, fetchStoredObjectBuffer, uploadObjectBuffer } from '../../lib/objectStorage.js';
import { getTenantConfig, updateTenantConfig } from '../tenants/tenantConfig.service.js';
import type { TenantTeamLeaderTrainingConfig } from '../tenants/tenantConfig.schema.js';
import { teamLeaderTrainingCloudinaryFolder } from './teamLeaderTraining.helpers.js';

/** 표시·다운로드용 고정 파일명 — multipart 원본명(한글 깨짐) 저장하지 않음 */
export const TEAM_LEADER_TRAINING_PDF_FILENAME = '현장팀장 교육자료.pdf';

export type TeamLeaderTrainingMeta = {
  available: boolean;
  fileName: string | null;
  updatedAt: string | null;
};

async function fetchPdfBufferFromStore(publicId: string): Promise<Buffer> {
  try {
    return await fetchStoredObjectBuffer(publicId);
  } catch (e) {
    const status = (e as { status?: number }).status;
    console.error('[team-leader-training] store download failed', { publicId, status });
    throw Object.assign(new Error('교육자료 파일을 불러올 수 없습니다.'), {
      code: 'upstream',
      status,
    });
  }
}

function readTrainingConfig(config: Awaited<ReturnType<typeof getTenantConfig>>): TenantTeamLeaderTrainingConfig | undefined {
  return config.teamLeaderTraining;
}

export function teamLeaderTrainingMetaFromConfig(
  training: TenantTeamLeaderTrainingConfig | undefined,
): TeamLeaderTrainingMeta {
  const hasPdf = Boolean(training?.pdfPublicId?.trim() && training?.pdfSecureUrl?.trim());
  return {
    available: hasPdf,
    fileName: hasPdf ? TEAM_LEADER_TRAINING_PDF_FILENAME : null,
    updatedAt: hasPdf ? training?.updatedAt?.trim() || null : null,
  };
}

export async function getTeamLeaderTrainingMeta(tenantId: string): Promise<TeamLeaderTrainingMeta> {
  const config = await getTenantConfig(tenantId);
  return teamLeaderTrainingMetaFromConfig(readTrainingConfig(config));
}

async function destroyCloudinaryPdf(publicId: string | undefined): Promise<void> {
  await destroyStoredObject(publicId, 'raw');
}

export async function uploadTeamLeaderTrainingPdf(params: {
  tenantId: string;
  buffer: Buffer;
  fileName: string;
}): Promise<TeamLeaderTrainingMeta> {
  if (!isCloudinaryConfigured()) {
    throw Object.assign(new Error('파일 저장소가 준비되지 않았습니다.'), { code: 'cloudinary' });
  }

  const existing = readTrainingConfig(await getTenantConfig(params.tenantId));
  const folder = teamLeaderTrainingCloudinaryFolder(params.tenantId);
  const result = await uploadObjectBuffer({
    folder,
    buffer: params.buffer,
    contentType: 'application/pdf',
    resourceType: 'raw',
    fileNameHint: 'training.pdf',
  });

  const updatedAt = new Date().toISOString();
  await updateTenantConfig(params.tenantId, {
    teamLeaderTraining: {
      pdfPublicId: result.publicId,
      pdfSecureUrl: result.secureUrl,
      fileName: TEAM_LEADER_TRAINING_PDF_FILENAME,
      updatedAt,
    },
  });

  if (existing?.pdfPublicId && existing.pdfPublicId !== result.publicId) {
    await destroyCloudinaryPdf(existing.pdfPublicId);
  }

  return {
    available: true,
    fileName: TEAM_LEADER_TRAINING_PDF_FILENAME,
    updatedAt,
  };
}

export async function fetchTeamLeaderTrainingPdf(params: {
  tenantId: string;
}): Promise<{ buffer: Buffer; fileName: string; updatedAt: string | null }> {
  const config = await getTenantConfig(params.tenantId);
  const training = readTrainingConfig(config);
  const publicId = training?.pdfPublicId?.trim();
  if (!publicId || !isCloudinaryConfigured()) {
    throw Object.assign(new Error('등록된 교육자료가 없습니다.'), { code: 'not_found' });
  }

  const buffer = await fetchPdfBufferFromStore(publicId);
  return {
    buffer,
    fileName: TEAM_LEADER_TRAINING_PDF_FILENAME,
    updatedAt: training?.updatedAt?.trim() || null,
  };
}
