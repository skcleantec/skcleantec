import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ensurePlatformBillingSettings } from '../billing/tenantBilling.service.js';
import { parsePaymentNotifyEmailsFromSettings } from '../../lib/platformBillingNotifyEmails.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import {
  PLATFORM_SUPPORT_EMAIL_DEBOUNCE_MS,
  PLATFORM_SUPPORT_MAX_BODY,
  previewSupportBody,
} from './platformSupportMessage.constants.js';
import { notifyPlatformSupportTenantMessageByEmail } from './platformSupportMessage.email.js';
import { serializeSupportMessage, type PlatformSupportThreadDto } from './platformSupportMessage.serialize.js';

type Db = PrismaClient | Prisma.TransactionClient;

const messageInclude = {
  senderPlatformUser: { select: { name: true } },
  senderUser: { select: { name: true, role: true } },
} as const;

export class PlatformSupportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformSupportValidationError';
  }
}

export class PlatformSupportNotFoundError extends Error {
  constructor(message = '대화방을 찾을 수 없습니다.') {
    super(message);
    this.name = 'PlatformSupportNotFoundError';
  }
}

function normalizeBody(raw: string): string {
  const body = raw.trim();
  if (!body) throw new PlatformSupportValidationError('메시지 내용을 입력해 주세요.');
  if (body.length > PLATFORM_SUPPORT_MAX_BODY) {
    throw new PlatformSupportValidationError(`메시지는 ${PLATFORM_SUPPORT_MAX_BODY}자까지 입력할 수 있습니다.`);
  }
  return body;
}

function employedOfficeWhere(tenantId: string): Prisma.UserWhereInput {
  const now = new Date();
  return {
    tenantId,
    role: { in: ['ADMIN', 'MARKETER'] },
    isActive: true,
    OR: [{ resignationDate: null }, { resignationDate: { gt: now } }],
  };
}

async function listOfficeStaffUserIds(tenantId: string, db: Db = prisma): Promise<string[]> {
  const rows = await db.user.findMany({
    where: employedOfficeWhere(tenantId),
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function ensureSupportThread(tenantId: string, db: Db = prisma) {
  const existing = await db.platformSupportThread.findFirst({
    where: { tenantId },
  });
  if (existing) return existing;
  return db.platformSupportThread.create({
    data: { tenantId },
  });
}

async function markTenantRead(threadId: string, tenantId: string, userId: string, db: Db = prisma) {
  await db.platformSupportTenantRead.upsert({
    where: { threadId_userId: { threadId, userId } },
    create: { threadId, tenantId, userId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });
}

async function countTenantUnread(threadId: string, userId: string, db: Db = prisma): Promise<number> {
  const read = await db.platformSupportTenantRead.findFirst({
    where: { threadId, userId },
    select: { lastReadAt: true },
  });
  return db.platformSupportMessage.count({
    where: {
      threadId,
      senderKind: 'PLATFORM',
      ...(read ? { createdAt: { gt: read.lastReadAt } } : {}),
    },
  });
}

function isPlatformUnread(thread: {
  lastSenderKind: string | null;
  lastMessageAt: Date;
  platformReadAt: Date | null;
}): boolean {
  if (thread.lastSenderKind !== 'TENANT') return false;
  if (!thread.platformReadAt) return true;
  return thread.lastMessageAt > thread.platformReadAt;
}

async function loadThreadDto(
  threadId: string,
  tenantId: string,
  unreadCount: number,
  db: Db = prisma,
): Promise<PlatformSupportThreadDto> {
  const thread = await db.platformSupportThread.findFirst({
    where: { id: threadId, tenantId },
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: messageInclude,
      },
    },
  });
  if (!thread) throw new PlatformSupportNotFoundError();
  return {
    id: thread.id,
    tenantId: thread.tenantId,
    tenantName: thread.tenant.name,
    tenantSlug: thread.tenant.slug,
    lastMessageAt: thread.lastMessageAt.toISOString(),
    lastMessagePreview: thread.lastMessagePreview,
    lastSenderKind: thread.lastSenderKind,
    waitingOn: thread.waitingOn,
    unreadCount,
    messages: thread.messages.map(serializeSupportMessage),
  };
}

export async function getTenantSupportThread(tenantId: string, userId: string): Promise<PlatformSupportThreadDto> {
  const thread = await ensureSupportThread(tenantId);
  await markTenantRead(thread.id, tenantId, userId);
  return loadThreadDto(thread.id, tenantId, 0);
}

export async function getTenantSupportSummary(tenantId: string, userId: string) {
  const thread = await prisma.platformSupportThread.findFirst({
    where: { tenantId },
    select: {
      id: true,
      lastMessageAt: true,
      lastMessagePreview: true,
    },
  });
  if (!thread) {
    return {
      id: null,
      lastMessageAt: null as string | null,
      lastMessagePreview: '',
      unreadCount: 0,
    };
  }
  const unreadCount = await countTenantUnread(thread.id, userId);
  return {
    id: thread.id,
    lastMessageAt: thread.lastMessageAt.toISOString(),
    lastMessagePreview: thread.lastMessagePreview,
    unreadCount,
  };
}

export async function countTenantSupportUnread(tenantId: string, userId: string): Promise<number> {
  const thread = await prisma.platformSupportThread.findFirst({
    where: { tenantId },
    select: { id: true },
  });
  if (!thread) return 0;
  return countTenantUnread(thread.id, userId);
}

export async function postTenantSupportMessage(input: {
  tenantId: string;
  userId: string;
  userName?: string;
  userRole: string;
  body: string;
}) {
  const body = normalizeBody(input.body);
  const sender = await prisma.user.findFirst({
    where: { id: input.userId, tenantId: input.tenantId },
    select: { name: true, role: true },
  });
  const senderName = sender?.name?.trim() || input.userName?.trim() || '업체';
  const senderRole = sender?.role || input.userRole;
  const thread = await ensureSupportThread(input.tenantId);
  const now = new Date();
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.platformSupportMessage.create({
      data: {
        threadId: thread.id,
        tenantId: input.tenantId,
        body,
        senderKind: 'TENANT',
        senderUserId: input.userId,
      },
      include: messageInclude,
    });
    await tx.platformSupportThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: now,
        lastMessagePreview: previewSupportBody(body),
        lastSenderKind: 'TENANT',
        waitingOn: 'PLATFORM',
      },
    });
    await markTenantRead(thread.id, input.tenantId, input.userId, tx);
    return created;
  });

  const staffIds = await listOfficeStaffUserIds(input.tenantId);
  void notifyInboxRefresh(staffIds);

  const shouldEmail =
    !thread.lastTenantEmailAt ||
    now.getTime() - thread.lastTenantEmailAt.getTime() >= PLATFORM_SUPPORT_EMAIL_DEBOUNCE_MS;
  if (shouldEmail) {
    const settings = await ensurePlatformBillingSettings();
    const emails = parsePaymentNotifyEmailsFromSettings(settings);
    const tenant = await prisma.tenant.findFirst({
      where: { id: input.tenantId },
      select: { name: true, slug: true },
    });
    if (tenant && emails.length > 0) {
      void notifyPlatformSupportTenantMessageByEmail({
        notifyEmails: emails,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        senderName,
        senderRoleLabel: senderRole === 'MARKETER' ? '마케터' : '관리자',
        body,
      }).then(async () => {
        await prisma.platformSupportThread.update({
          where: { id: thread.id },
          data: { lastTenantEmailAt: new Date() },
        });
      });
    }
  }

  return serializeSupportMessage(message);
}

export async function countPlatformSupportUnreadSafe(): Promise<number> {
  const rows = await prisma.platformSupportThread.findMany({
    where: { lastSenderKind: 'TENANT' },
    select: { lastMessageAt: true, platformReadAt: true, lastSenderKind: true },
  });
  return rows.filter(isPlatformUnread).length;
}

export async function listPlatformSupportThreads(input: {
  q?: string;
  waiting?: 'PLATFORM' | 'TENANT' | 'all';
  unreadOnly?: boolean;
  limit: number;
  offset: number;
}) {
  const where: Prisma.PlatformSupportThreadWhereInput = {};
  if (input.waiting === 'PLATFORM' || input.waiting === 'TENANT') {
    where.waitingOn = input.waiting;
  }
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.tenant = {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ],
    };
  }

  const rows = await prisma.platformSupportThread.findMany({
    where,
    include: { tenant: { select: { id: true, name: true, slug: true } } },
    orderBy: { lastMessageAt: 'desc' },
  });
  const filtered = input.unreadOnly ? rows.filter(isPlatformUnread) : rows;
  const total = filtered.length;
  const page = filtered.slice(input.offset, input.offset + input.limit);
  return {
    total,
    items: page.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      tenantName: row.tenant.name,
      tenantSlug: row.tenant.slug,
      lastMessageAt: row.lastMessageAt.toISOString(),
      lastMessagePreview: row.lastMessagePreview,
      lastSenderKind: row.lastSenderKind,
      waitingOn: row.waitingOn,
      unread: isPlatformUnread(row),
    })),
  };
}

export async function getPlatformSupportThread(tenantId: string): Promise<PlatformSupportThreadDto> {
  const thread = await ensureSupportThread(tenantId);
  await prisma.platformSupportThread.update({
    where: { id: thread.id },
    data: { platformReadAt: new Date() },
  });
  const unread = 0;
  return loadThreadDto(thread.id, tenantId, unread);
}

async function appendPlatformMessage(input: {
  tenantId: string;
  platformUserId: string;
  body: string;
  broadcastBatchId?: string;
}) {
  const body = normalizeBody(input.body);
  const thread = await ensureSupportThread(input.tenantId);
  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.platformSupportMessage.create({
      data: {
        threadId: thread.id,
        tenantId: input.tenantId,
        body,
        senderKind: 'PLATFORM',
        senderPlatformUserId: input.platformUserId,
        broadcastBatchId: input.broadcastBatchId ?? null,
      },
      include: messageInclude,
    });
    await tx.platformSupportThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: now,
        lastMessagePreview: previewSupportBody(body),
        lastSenderKind: 'PLATFORM',
        waitingOn: 'TENANT',
        platformReadAt: now,
      },
    });
    return message;
  });
  const staffIds = await listOfficeStaffUserIds(input.tenantId);
  void notifyInboxRefresh(staffIds);
  return created;
}

export async function postPlatformSupportMessage(input: {
  tenantId: string;
  platformUserId: string;
  body: string;
}) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: input.tenantId },
    select: { id: true },
  });
  if (!tenant) throw new PlatformSupportNotFoundError('업체를 찾을 수 없습니다.');
  const created = await appendPlatformMessage(input);
  return serializeSupportMessage(created);
}

export async function listBroadcastableTenants(q?: string) {
  return prisma.tenant.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIAL'] },
      ...(q?.trim()
        ? {
            OR: [
              { name: { contains: q.trim(), mode: 'insensitive' } },
              { slug: { contains: q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, slug: true, status: true },
    orderBy: { name: 'asc' },
  });
}

export async function broadcastPlatformSupportMessage(input: {
  platformUserId: string;
  body: string;
  tenantIds?: string[];
}) {
  const body = normalizeBody(input.body);
  let targets = input.tenantIds?.filter(Boolean) ?? [];
  if (targets.length === 0) {
    const all = await listBroadcastableTenants();
    targets = all.map((t) => t.id);
  } else {
    const allowed = await prisma.tenant.findMany({
      where: { id: { in: targets }, status: { in: ['ACTIVE', 'TRIAL'] } },
      select: { id: true },
    });
    targets = allowed.map((t) => t.id);
  }
  if (targets.length === 0) {
    throw new PlatformSupportValidationError('보낼 업체가 없습니다.');
  }

  const batchId = crypto.randomUUID();
  let sent = 0;
  for (const tenantId of targets) {
    await appendPlatformMessage({
      tenantId,
      platformUserId: input.platformUserId,
      body,
      broadcastBatchId: batchId,
    });
    sent += 1;
  }
  return { batchId, sent };
}
