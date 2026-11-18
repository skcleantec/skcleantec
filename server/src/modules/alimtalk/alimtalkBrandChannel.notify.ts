import { ALIMTALK_TEMPLATE_LABELS, type AlimtalkTemplateCode } from '../../lib/alimtalkPolicy.js';
import { prisma } from '../../lib/prisma.js';
import { notifyPlatformOps } from '../platform/platformInboxNotify.service.js';
import { sendAlimtalkOpsMail } from './alimtalkBarobillOpsMail.js';

export type BrandChannelNoticeKind = 'approved' | 'rejected' | 'linked';

export function brandTemplateLabel(templateCode: string, fallback: string): string {
  return ALIMTALK_TEMPLATE_LABELS[templateCode as AlimtalkTemplateCode] ?? fallback;
}

export function brandChannelNoticeSubject(kind: BrandChannelNoticeKind, brandName: string, searchId: string): string {
  const what =
    kind === 'approved' ? '카카오 채널 서식 승인' : kind === 'rejected' ? '카카오 채널 서식 반려' : '카카오 채널 연결';
  return `[청소비서] ${what} — ${brandName}(${searchId})`;
}

function statusWord(status: string): string {
  if (status === 'IN_REVIEW') return '심사 중';
  if (status === 'REJECTED') return '반려';
  if (status === 'APPROVED') return '승인';
  return '신청 대기';
}

export function approvalNoticeBody(input: {
  tenantName: string;
  brandName: string;
  searchId: string;
  approvedNames: string[];
  remaining: { name: string; status: string }[];
}): string {
  const rest =
    input.remaining.length > 0
      ? input.remaining.map((row) => `· ${row.name} · ${statusWord(row.status)}`).join('\n')
      : '· 없음';
  return [
    `${input.tenantName} · ${input.brandName} · ${input.searchId}`,
    '',
    '승인된 서식',
    ...input.approvedNames.map((name) => `· ${name}`),
    '',
    '남은 서식',
    rest,
    '',
    '이제 승인된 서식은 이 채널로 보냅니다.',
  ].join('\n');
}

export function rejectionNoticeBody(input: {
  tenantName: string;
  brandName: string;
  searchId: string;
  rejected: { name: string; reason: string }[];
}): string {
  return [
    `${input.tenantName} · ${input.brandName} · ${input.searchId}`,
    '',
    '반려된 서식',
    ...input.rejected.map((row) => `· ${row.name}\n  ${row.reason}`),
  ].join('\n');
}

export function linkedNoticeBody(input: { tenantName: string; brandName: string; searchId: string }): string {
  return [
    `${input.tenantName} · ${input.brandName} · ${input.searchId}`,
    '',
    '카카오 채널이 연결되었습니다. 승인된 서식부터 이 채널로 보냅니다.',
  ].join('\n');
}

async function deliver(input: {
  tenantId: string;
  tenantName: string;
  subject: string;
  title: string;
  text: string;
}): Promise<void> {
  await sendAlimtalkOpsMail(input.subject, input.text);
  await notifyPlatformOps({
    event: 'brand_channel',
    tenantId: input.tenantId,
    tenantLabel: input.tenantName,
    title: input.title,
    body: input.text,
    email: false,
  });
}

export async function notifyBrandTemplatesApproved(input: {
  tenantId: string;
  tenantName: string;
  brandName: string;
  searchId: string;
  templateIds: string[];
  approvedNames: string[];
  remaining: { name: string; status: string }[];
  now: Date;
}): Promise<void> {
  if (input.templateIds.length === 0) return;
  const claimed = await prisma.alimtalkBrandTemplate.updateMany({
    where: {
      id: { in: input.templateIds },
      approvedNotifiedAt: null,
      brandChannel: { tenantId: input.tenantId },
    },
    data: { approvedNotifiedAt: input.now },
  });
  if (claimed.count === 0) return;
  const subject = brandChannelNoticeSubject('approved', input.brandName, input.searchId);
  const text = approvalNoticeBody(input);
  try {
    await deliver({
      tenantId: input.tenantId,
      tenantName: input.tenantName,
      subject,
      title: `카카오 채널 서식 승인 — ${input.brandName}(${input.searchId})`,
      text,
    });
  } catch (err) {
    await prisma.alimtalkBrandTemplate.updateMany({
      where: {
        id: { in: input.templateIds },
        approvedNotifiedAt: input.now,
        brandChannel: { tenantId: input.tenantId },
      },
      data: { approvedNotifiedAt: null },
    });
    throw err;
  }
}

export async function notifyBrandTemplatesRejected(input: {
  tenantId: string;
  tenantName: string;
  brandName: string;
  searchId: string;
  rejected: { id: string; name: string; reason: string }[];
  now: Date;
}): Promise<void> {
  const ids = input.rejected.map((row) => row.id);
  if (ids.length === 0) return;
  const claimed = await prisma.alimtalkBrandTemplate.updateMany({
    where: {
      id: { in: ids },
      rejectedNotifiedAt: null,
      brandChannel: { tenantId: input.tenantId },
    },
    data: { rejectedNotifiedAt: input.now },
  });
  if (claimed.count === 0) return;
  const subject = brandChannelNoticeSubject('rejected', input.brandName, input.searchId);
  const text = rejectionNoticeBody(input);
  try {
    await deliver({
      tenantId: input.tenantId,
      tenantName: input.tenantName,
      subject,
      title: `카카오 채널 서식 반려 — ${input.brandName}(${input.searchId})`,
      text,
    });
  } catch (err) {
    await prisma.alimtalkBrandTemplate.updateMany({
      where: {
        id: { in: ids },
        rejectedNotifiedAt: input.now,
        brandChannel: { tenantId: input.tenantId },
      },
      data: { rejectedNotifiedAt: null },
    });
    throw err;
  }
}

export async function notifyBrandChannelLinked(input: {
  tenantId: string;
  channelId: string;
  tenantName: string;
  brandName: string;
  searchId: string;
  now: Date;
}): Promise<void> {
  const claimed = await prisma.alimtalkBrandChannel.updateMany({
    where: { id: input.channelId, tenantId: input.tenantId, linkedNotifiedAt: null },
    data: { linkedNotifiedAt: input.now },
  });
  if (claimed.count === 0) return;
  const subject = brandChannelNoticeSubject('linked', input.brandName, input.searchId);
  const text = linkedNoticeBody(input);
  try {
    await deliver({
      tenantId: input.tenantId,
      tenantName: input.tenantName,
      subject,
      title: `카카오 채널 연결 — ${input.brandName}(${input.searchId})`,
      text,
    });
  } catch (err) {
    await prisma.alimtalkBrandChannel.updateMany({
      where: { id: input.channelId, tenantId: input.tenantId, linkedNotifiedAt: input.now },
      data: { linkedNotifiedAt: null },
    });
    throw err;
  }
}
