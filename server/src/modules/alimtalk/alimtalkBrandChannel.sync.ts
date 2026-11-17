import type { BarobillKakaoChannel, BarobillKakaoTemplate } from '../../lib/barobill/kakaotalk.js';
import { getChannels, getTemplates } from '../../lib/barobill/kakaotalk.js';
import { prisma } from '../../lib/prisma.js';
import { sendAlimtalkOpsMail } from './alimtalkBarobillOpsMail.js';
import { BAROBILL_TEMPLATE_NAME_BY_CODE } from './alimtalkBarobillSync.service.js';
import { channelIdsMatch, mapProviderTemplateStatus } from './alimtalkBrandChannel.select.js';
import { ensureBrandChannelSetupFee } from './alimtalkBrandChannel.fee.js';

const HOUR_MS = 60 * 60 * 1000;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let lastCheckedAt: string | null = null;

export function brandChannelLastCheckedAt(): string | null {
  return lastCheckedAt;
}

export async function syncAlimtalkBrandChannels(): Promise<{ checked: number; disconnected: number }> {
  const remoteChannels = await getChannels();
  const locals = await prisma.alimtalkBrandChannel.findMany({
    where: { status: { in: ['REQUESTED', 'LINKED', 'ACTIVE'] } },
    include: {
      templates: true,
      tenant: { select: { name: true } },
      operatingCompany: { select: { name: true } },
    },
  });
  const gone: string[] = [];
  const now = new Date();
  for (const local of locals) {
    const hit = remoteChannels.find((row) => channelIdsMatch(local.searchId, local.providerChannelId, row.ChannelId));
    if (!hit) {
      if (local.status === 'LINKED' || local.status === 'ACTIVE') {
        await prisma.alimtalkBrandChannel.update({
          where: { id: local.id },
          data: { status: 'DISCONNECTED' },
        });
        gone.push(`${local.tenant.name} · ${local.operatingCompany.name} · ${local.searchId} · 발송 서비스 채널 목록에 없습니다.`);
      }
      continue;
    }
    if (local.status === 'REQUESTED') {
      await prisma.alimtalkBrandChannel.update({
        where: { id: local.id },
        data: { status: 'LINKED', providerChannelId: hit.ChannelId, linkedAt: now },
      });
      await ensureReadyTemplates(local.id);
      await ensureBrandChannelSetupFee(local.id);
    } else if (local.providerChannelId !== hit.ChannelId) {
      await prisma.alimtalkBrandChannel.update({
        where: { id: local.id },
        data: { providerChannelId: hit.ChannelId },
      });
    }
    await refreshTemplates(local.id, hit.ChannelId, now);
  }
  lastCheckedAt = now.toISOString();
  if (gone.length > 0) {
    await sendAlimtalkOpsMail(
      '[청소비서] 카카오 채널 연결이 끊어졌습니다',
      ['발송 서비스 채널 목록에서 사라진 브랜드입니다.', '', ...gone].join('\n'),
    );
  }
  return { checked: locals.length, disconnected: gone.length };
}

async function ensureReadyTemplates(brandChannelId: string): Promise<void> {
  for (const [templateCode, providerTemplateName] of Object.entries(BAROBILL_TEMPLATE_NAME_BY_CODE)) {
    await prisma.alimtalkBrandTemplate.upsert({
      where: { brandChannelId_templateCode: { brandChannelId, templateCode } },
      create: { brandChannelId, templateCode, providerTemplateName, status: 'READY' },
      update: {},
    });
  }
}

async function refreshTemplates(brandChannelId: string, channelId: string, now: Date): Promise<void> {
  let remote: BarobillKakaoTemplate[] = [];
  try {
    remote = await getTemplates(channelId);
  } catch {
    return;
  }
  const rows = await prisma.alimtalkBrandTemplate.findMany({ where: { brandChannelId } });
  for (const row of rows) {
    const hit = remote.find((item) => item.TemplateName.trim() === row.providerTemplateName.trim());
    if (!hit) {
      await prisma.alimtalkBrandTemplate.update({
        where: { id: row.id },
        data: { lastCheckedAt: now },
      });
      continue;
    }
    const status = mapProviderTemplateStatus(hit.Status);
    await prisma.alimtalkBrandTemplate.update({
      where: { id: row.id },
      data: {
        status,
        rejectReason: status === 'REJECTED' ? row.rejectReason || '카카오 심사에서 반려되었습니다.' : null,
        submittedAt: status === 'IN_REVIEW' || status === 'APPROVED' ? row.submittedAt ?? now : row.submittedAt,
        approvedAt: status === 'APPROVED' ? row.approvedAt ?? now : row.approvedAt,
        lastCheckedAt: now,
      },
    });
  }
  const approved = await prisma.alimtalkBrandTemplate.count({
    where: { brandChannelId, status: 'APPROVED' },
  });
  if (approved > 0) {
    await prisma.alimtalkBrandChannel.updateMany({
      where: { id: brandChannelId, status: { in: ['LINKED', 'REQUESTED'] } },
      data: { status: 'ACTIVE' },
    });
  }
}

export function startAlimtalkBrandChannelSync(): void {
  if (timer) return;
  const tick = () => {
    if (running) return;
    running = true;
    void syncAlimtalkBrandChannels()
      .then((summary) => {
        if (summary.checked > 0) console.info('[alimtalk-brand-channel] sync', summary);
      })
      .catch((err) => {
        console.error('[alimtalk-brand-channel] sync failed', err instanceof Error ? err.name : 'error');
      })
      .finally(() => {
        running = false;
      });
  };
  timer = setInterval(tick, HOUR_MS);
  timer.unref();
}

export type { BarobillKakaoChannel };
