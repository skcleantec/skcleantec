import fs from 'fs';
import path from 'path';
import { prisma } from '../../lib/prisma.js';
import {
  DEFAULT_TENANT_ID,
  DEFAULT_TENANT_SLUG,
  LEGACY_SK_TENANT_SLUG,
  PUBLIC_SK_CONTACT_SLUG,
} from '../tenants/tenant.constants.js';

const SK_SLUGS = new Set(
  [LEGACY_SK_TENANT_SLUG, DEFAULT_TENANT_SLUG, PUBLIC_SK_CONTACT_SLUG].map((s) => s.toLowerCase()),
);

function imageDirectory(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'assets/sk-team-leader-training'),
    path.resolve(process.cwd(), 'server/assets/sk-team-leader-training'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir;
  }
  return null;
}

export type SkTrainingImage = {
  index: number;
  title: string;
  filePath: string;
};

function titleFromFileName(name: string): string {
  return name.replace(/\.jpe?g$/i, '').replace(/^\d+_/, '');
}

export function listSkTeamTrainingImages(): SkTrainingImage[] {
  const dir = imageDirectory();
  if (!dir) return [];
  const names = fs
    .readdirSync(dir)
    .filter((name) => /\.jpe?g$/i.test(name))
    .sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
  return names.map((name, index) => ({
    index,
    title: titleFromFileName(name),
    filePath: path.resolve(dir, name),
  }));
}

/** SK클린텍 테넌트만. 다른 업체 팀장에게는 이 이미지 자료를 주지 않는다. */
export async function isSkTeamTrainingTenant(tenantId: string): Promise<boolean> {
  if (tenantId === DEFAULT_TENANT_ID) return true;
  const row = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { slug: true },
  });
  return SK_SLUGS.has((row?.slug ?? '').trim().toLowerCase());
}

export async function skTeamTrainingImageMeta(tenantId: string): Promise<{
  available: true;
  kind: 'images';
  imageCount: number;
  fileName: null;
  updatedAt: null;
} | null> {
  if (!(await isSkTeamTrainingTenant(tenantId))) return null;
  const images = listSkTeamTrainingImages();
  if (images.length === 0) return null;
  return {
    available: true,
    kind: 'images',
    imageCount: images.length,
    fileName: null,
    updatedAt: null,
  };
}

export async function skTeamTrainingImageFile(
  tenantId: string,
  index: number,
): Promise<SkTrainingImage | null> {
  if (!(await isSkTeamTrainingTenant(tenantId))) return null;
  if (!Number.isInteger(index) || index < 0) return null;
  return listSkTeamTrainingImages()[index] ?? null;
}
