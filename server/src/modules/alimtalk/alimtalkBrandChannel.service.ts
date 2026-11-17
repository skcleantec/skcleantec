import { ALIMTALK_TEMPLATE_LABELS, type AlimtalkTemplateCode } from '../../lib/alimtalkPolicy.js';
import { prisma } from '../../lib/prisma.js';
import { sendAlimtalkOpsMail } from './alimtalkBarobillOpsMail.js';
import { BAROBILL_TEMPLATE_NAME_BY_CODE } from './alimtalkBarobillSync.service.js';
import { ensureBrandChannelSetupFee, readBrandChannelFees } from './alimtalkBrandChannel.fee.js';
import { normalizeSearchId } from './alimtalkBrandChannel.select.js';

const BIZ = new Set(['DONE', 'IN_REVIEW', 'NONE']);

export function templateStatusLabel(status: string): string {
  if (status === 'APPROVED') return '승인';
  if (status === 'IN_REVIEW') return '심사 중';
  if (status === 'REJECTED') return '반려';
  return '신청 대기';
}

export function channelBadge(status: string, searchId: string): { label: string; tone: 'emerald' | 'amber' | 'slate' } {
  if (status === 'LINKED' || status === 'ACTIVE') return { label: `채널 연결됨 · ${searchId}`, tone: 'emerald' };
  if (status === 'REQUESTED') return { label: '신청 접수 · 연결 필요', tone: 'amber' };
  if (status === 'DISCONNECTED') return { label: '채널 끊김 · 청소비서로 보냄', tone: 'slate' };
  return { label: '채널 없음 · 청소비서로 보냄', tone: 'slate' };
}

function stepIndex(status: string, approved: number): number {
  if (status === 'REQUESTED') return 0;
  if (status === 'LINKED' && approved === 0) return 2;
  if (status === 'ACTIVE' || approved > 0) return approved > 0 ? 3 : 2;
  if (status === 'DISCONNECTED' || status === 'REJECTED') return 1;
  return 0;
}

export async function listTenantBrandChannels(tenantId: string) {
  const fees = await readBrandChannelFees();
  const brands = await prisma.operatingCompany.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    include: { alimtalkBrandChannel: { include: { templates: true } } },
  });
  return {
    setupFeeKrw: fees.setupFeeKrw,
    customCopyFeeKrw: fees.customCopyFeeKrw,
    brands: brands.map((brand) => {
      const channel = brand.alimtalkBrandChannel;
      const templates = channel?.templates ?? [];
      const approved = templates.filter((row) => row.status === 'APPROVED').length;
      return {
        operatingCompanyId: brand.id,
        name: brand.name,
        channel: channel
          ? {
              id: channel.id,
              searchId: channel.searchId,
              adminPhone: channel.adminPhone,
              bizVerify: channel.bizVerify,
              status: channel.status,
              badge: channelBadge(channel.status, channel.searchId),
              setupFeeKrw: channel.setupFeeKrw,
              step: stepIndex(channel.status, approved),
              approved,
              templateCount: templates.length,
              note:
                channel.status === 'REQUESTED'
                  ? '신청을 받았어요. 담당자가 채널 연결을 시작해요.'
                  : channel.status === 'DISCONNECTED'
                    ? '채널 연결이 끊어져 청소비서 채널로 보내고 있어요.'
                    : approved > 0
                      ? '승인된 문구부터 우리 채널로 보내고 있어요.'
                      : '채널은 연결됐고, 문구 심사가 끝나면 우리 채널로 바뀌어요.',
            }
          : null,
      };
    }),
  };
}

export async function requestBrandChannel(
  tenantId: string,
  input: {
    operatingCompanyId: string;
    searchId: string;
    adminPhone: string;
    bizVerify: string;
    publicReady: boolean;
    feeAccepted: boolean;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.publicReady || !input.feeAccepted) return { ok: false, error: '준비 확인과 세팅비 안내에 동의해 주세요.' };
  if (!BIZ.has(input.bizVerify)) return { ok: false, error: '비즈니스 인증 상태를 선택해 주세요.' };
  if (input.bizVerify === 'NONE') return { ok: false, error: '비즈니스 인증을 먼저 신청해 주세요.' };
  const searchId = normalizeSearchId(input.searchId);
  const adminPhone = input.adminPhone.replace(/[^\d-]/g, '').trim();
  if (!searchId || searchId === '@') return { ok: false, error: '채널 검색용 아이디를 입력해 주세요.' };
  if (adminPhone.length < 8) return { ok: false, error: '채널 관리자 연락처를 입력해 주세요.' };
  const brand = await prisma.operatingCompany.findFirst({
    where: { id: input.operatingCompanyId, tenantId, isActive: true },
    select: { id: true, name: true, tenant: { select: { name: true } } },
  });
  if (!brand) return { ok: false, error: '브랜드를 찾을 수 없습니다.' };
  const existing = await prisma.alimtalkBrandChannel.findFirst({
    where: { tenantId, operatingCompanyId: brand.id },
    select: { id: true },
  });
  if (existing) return { ok: false, error: '이미 신청한 브랜드입니다.' };
  const fees = await readBrandChannelFees();
  await prisma.alimtalkBrandChannel.create({
    data: {
      tenantId,
      operatingCompanyId: brand.id,
      searchId,
      adminPhone,
      bizVerify: input.bizVerify,
      status: 'REQUESTED',
      setupFeeKrw: fees.setupFeeKrw,
    },
  });
  await sendAlimtalkOpsMail(
    '[청소비서] 카카오 채널 연결 신청',
    [`업체: ${brand.tenant.name}`, `브랜드: ${brand.name}`, `채널: ${searchId}`, `연락처: ${adminPhone}`].join('\n'),
  );
  return { ok: true };
}

export async function listPlatformBrandChannels() {
  const fees = await readBrandChannelFees();
  const rows = await prisma.alimtalkBrandChannel.findMany({
    include: {
      templates: { orderBy: { templateCode: 'asc' } },
      tenant: { select: { id: true, name: true } },
      operatingCompany: { select: { name: true } },
    },
    orderBy: { requestedAt: 'desc' },
  });
  const templates = rows.flatMap((row) => row.templates);
  return {
    fees,
    summary: {
      linked: rows.filter((row) => row.status === 'LINKED' || row.status === 'ACTIVE').length,
      inReview: templates.filter((row) => row.status === 'IN_REVIEW').length,
      rejected: templates.filter((row) => row.status === 'REJECTED').length,
      ready: templates.filter((row) => row.status === 'READY').length,
      needsLink: rows.filter((row) => row.status === 'REQUESTED').length,
    },
    rows: rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant.id,
      tenantName: row.tenant.name,
      brandName: row.operatingCompany.name,
      searchId: row.searchId,
      status: row.status,
      badge: channelBadge(row.status, row.searchId),
      approved: row.templates.filter((item) => item.status === 'APPROVED').length,
      templateCount: Object.keys(BAROBILL_TEMPLATE_NAME_BY_CODE).length,
      templates: row.templates.map((item) => ({
        code: item.templateCode,
        label: ALIMTALK_TEMPLATE_LABELS[item.templateCode as AlimtalkTemplateCode] ?? item.providerTemplateName,
        status: item.status,
        statusLabel: templateStatusLabel(item.status),
        rejectReason: item.rejectReason,
        submittedAt: item.submittedAt?.toISOString() ?? null,
        sendsFrom: item.status === 'APPROVED' && (row.status === 'ACTIVE' || row.status === 'LINKED') ? row.operatingCompany.name : '청소비서',
      })),
    })),
  };
}

export async function listTenantBrandChannelDetail(tenantId: string) {
  const brands = await prisma.operatingCompany.findMany({
    where: { tenantId },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
    select: { id: true, name: true },
  });
  const channels = await prisma.alimtalkBrandChannel.findMany({
    where: { tenantId },
    include: { templates: { orderBy: { templateCode: 'asc' } } },
  });
  const byBrand = new Map(channels.map((row) => [row.operatingCompanyId, row]));
  return brands.map((brand) => {
    const channel = byBrand.get(brand.id) ?? null;
    const approved = channel?.templates.filter((item) => item.status === 'APPROVED').length ?? 0;
    return {
      operatingCompanyId: brand.id,
      name: brand.name,
      channelId: channel?.id ?? null,
      searchId: channel?.searchId ?? null,
      status: channel?.status ?? null,
      badge: channel ? channelBadge(channel.status, channel.searchId) : channelBadge('NONE', ''),
      approved,
      templateCount: Object.keys(BAROBILL_TEMPLATE_NAME_BY_CODE).length,
      setupFeeExcluded: channel?.setupFeeExcluded ?? false,
      templates: (channel?.templates ?? []).map((item) => ({
        label: ALIMTALK_TEMPLATE_LABELS[item.templateCode as AlimtalkTemplateCode] ?? item.providerTemplateName,
        statusLabel: templateStatusLabel(item.status),
        status: item.status,
        rejectReason: item.rejectReason,
        submittedAt: item.submittedAt?.toISOString() ?? channel?.requestedAt.toISOString() ?? null,
        sendsFrom: item.status === 'APPROVED' && channel && (channel.status === 'ACTIVE' || channel.status === 'LINKED') ? brand.name : '청소비서',
      })),
    };
  });
}

export async function linkBrandChannel(input: {
  tenantId: string;
  operatingCompanyId: string;
  providerChannelId: string;
  createTemplates: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const providerChannelId = input.providerChannelId.trim();
  if (!providerChannelId) return { ok: false, error: '연결할 채널을 선택해 주세요.' };
  const taken = await prisma.alimtalkBrandChannel.findFirst({
    where: {
      providerChannelId,
      status: { not: 'DISCONNECTED' },
      NOT: { tenantId: input.tenantId, operatingCompanyId: input.operatingCompanyId },
    },
    select: { id: true },
  });
  if (taken) return { ok: false, error: '다른 브랜드가 이미 쓰는 채널입니다.' };
  const brand = await prisma.operatingCompany.findFirst({
    where: { id: input.operatingCompanyId, tenantId: input.tenantId },
    select: { id: true, name: true },
  });
  if (!brand) return { ok: false, error: '브랜드를 찾을 수 없습니다.' };
  const fees = await readBrandChannelFees();
  const channel = await prisma.alimtalkBrandChannel.upsert({
    where: { operatingCompanyId: brand.id },
    create: {
      tenantId: input.tenantId,
      operatingCompanyId: brand.id,
      searchId: normalizeSearchId(providerChannelId),
      adminPhone: '',
      bizVerify: 'DONE',
      status: 'LINKED',
      providerChannelId,
      linkedAt: new Date(),
      setupFeeKrw: fees.setupFeeKrw,
    },
    update: {
      status: 'LINKED',
      providerChannelId,
      linkedAt: new Date(),
    },
  });
  if (input.createTemplates) {
    for (const [templateCode, providerTemplateName] of Object.entries(BAROBILL_TEMPLATE_NAME_BY_CODE)) {
      await prisma.alimtalkBrandTemplate.upsert({
        where: { brandChannelId_templateCode: { brandChannelId: channel.id, templateCode } },
        create: { brandChannelId: channel.id, templateCode, providerTemplateName, status: 'READY' },
        update: {},
      });
    }
  }
  const approved = await prisma.alimtalkBrandTemplate.count({
    where: { brandChannelId: channel.id, status: 'APPROVED' },
  });
  if (approved > 0) {
    await prisma.alimtalkBrandChannel.update({ where: { id: channel.id }, data: { status: 'ACTIVE' } });
  }
  await ensureBrandChannelSetupFee(channel.id);
  return { ok: true };
}

export async function disconnectBrandChannel(tenantId: string, channelId: string): Promise<void> {
  await prisma.alimtalkBrandChannel.updateMany({
    where: { id: channelId, tenantId },
    data: { status: 'DISCONNECTED' },
  });
}

export async function excludeBrandChannelSetupFee(tenantId: string, channelId: string): Promise<void> {
  const updated = await prisma.alimtalkBrandChannel.updateMany({
    where: { id: channelId, tenantId },
    data: { setupFeeExcluded: true },
  });
  if (updated.count !== 1) return;
  await ensureBrandChannelSetupFee(channelId);
}
