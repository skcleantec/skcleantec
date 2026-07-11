import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';
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

function buildCloudinaryPrivateDownloadUrl(publicId: string): string {
  return cloudinary.utils.private_download_url(publicId, '', {
    resource_type: 'raw',
    type: 'upload',
    expires_at: Math.round(Date.now() / 1000) + 3600,
  });
}

async function fetchPdfBufferFromCloudinary(publicId: string): Promise<ArrayBuffer> {
  const url = buildCloudinaryPrivateDownloadUrl(publicId);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    console.error('[team-leader-training] cloudinary private download failed', {
      status: res.status,
      publicId,
    });
    throw Object.assign(new Error('교육자료 파일을 불러올 수 없습니다.'), {
      code: 'upstream',
      status: res.status,
    });
  }
  return res.arrayBuffer();
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
  const id = publicId?.trim();
  if (!id || !isCloudinaryConfigured()) return;
  try {
    await cloudinary.uploader.destroy(id, { resource_type: 'raw' });
  } catch (e) {
    console.warn('[team-leader-training] destroy old pdf failed', id, e);
  }
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
  const result = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'raw',
        public_id: `training_${Date.now()}`,
      },
      (err, res) => {
        if (err) reject(err);
        else if (!res?.public_id || !res.secure_url) reject(new Error('cloudinary_upload_failed'));
        else resolve(res as { public_id: string; secure_url: string });
      },
    );
    stream.end(params.buffer);
  });

  const updatedAt = new Date().toISOString();
  await updateTenantConfig(params.tenantId, {
    teamLeaderTraining: {
      pdfPublicId: result.public_id,
      pdfSecureUrl: result.secure_url,
      fileName: TEAM_LEADER_TRAINING_PDF_FILENAME,
      updatedAt,
    },
  });

  if (existing?.pdfPublicId && existing.pdfPublicId !== result.public_id) {
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

  const arrayBuffer = await fetchPdfBufferFromCloudinary(publicId);
  return {
    buffer: Buffer.from(arrayBuffer),
    fileName: TEAM_LEADER_TRAINING_PDF_FILENAME,
    updatedAt: training?.updatedAt?.trim() || null,
  };
}
