import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { destroyStoredObject } from '../../lib/objectStorage.js';
import { notifyMessageInboxRefresh } from '../notifications/staffAppPushDispatch.helpers.js';
import { notifyCrewGroupsInboxRefresh } from '../crew/crewFieldRealtime.js';
import { storeMessageFile } from './messageAttachment.images.js';
import {
  ATTACHMENT_ORPHAN_MS,
  countAttachmentKinds,
  deferReadUntilViewed,
  isBroadcastNotice,
  isOrphanAttachment,
  linksForTarget,
  messageListPreview,
  missingAttachmentIds,
  noticeIsRead,
  noticeReadAt,
  pageAfterCursor,
  remindBlockMinutes,
  validateUploadBatch,
  type UploadFileMeta,
} from './messageAttachment.logic.js';

type Db = PrismaClient | Prisma.TransactionClient;

export type MessageAttachmentDto = {
  id: string;
  kind: 'image' | 'pdf';
  fileName: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  pageCount: number | null;
  thumbUrl: string | null;
  previewUrl: string | null;
  originalUrl: string;
};

type AttachmentRow = {
  id: string;
  kind: string;
  fileName: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  pageCount: number | null;
  thumbUrl: string | null;
  previewUrl: string | null;
  originalUrl: string;
  tenantId: string;
};

export function toAttachmentDto(row: AttachmentRow): MessageAttachmentDto {
  return {
    id: row.id,
    kind: row.kind === 'pdf' ? 'pdf' : 'image',
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    pageCount: row.pageCount,
    thumbUrl: row.thumbUrl,
    previewUrl: row.previewUrl,
    originalUrl: row.originalUrl,
  };
}

export async function uploadMessageAttachments(input: {
  tenantId: string;
  uploaderId: string;
  files: Array<UploadFileMeta & { buffer: Buffer }>;
}): Promise<MessageAttachmentDto[]> {
  const invalid = validateUploadBatch(input.files);
  if (invalid) throw Object.assign(new Error(invalid), { status: 400 });
  const stored = [];
  for (const file of input.files) {
    stored.push(await storeMessageFile({ tenantId: input.tenantId, file }));
  }
  const created = [];
  for (const file of stored) {
    created.push(
      await prisma.messageAttachment.create({
        data: {
          tenantId: input.tenantId,
          uploaderId: input.uploaderId,
          kind: file.kind,
          fileName: file.fileName,
          sizeBytes: file.sizeBytes,
          width: file.width,
          height: file.height,
          pageCount: file.pageCount,
          originalUrl: file.originalUrl,
          previewUrl: file.previewUrl,
          thumbUrl: file.thumbUrl,
          storageKey: file.storageKey,
        },
      }),
    );
  }
  return created.map(toAttachmentDto);
}

export async function requireOwnedAttachmentIds(tenantId: string, attachmentIds: string[]): Promise<void> {
  if (attachmentIds.length === 0) return;
  const rows = await prisma.messageAttachment.findMany({
    where: { tenantId, id: { in: attachmentIds } },
    select: { id: true },
  });
  if (missingAttachmentIds(attachmentIds, rows.map((row) => row.id)).length > 0) {
    throw Object.assign(new Error('첨부 파일을 찾을 수 없습니다.'), { status: 400 });
  }
}

export async function linkAttachments(
  db: Db,
  tenantId: string,
  attachmentIds: string[],
  target: { batchId?: string; messageId?: string; crewNoticeBatchId?: string },
): Promise<void> {
  if (attachmentIds.length === 0) return;
  await db.messageAttachmentLink.createMany({
    data: linksForTarget(attachmentIds, target).map((link) => ({ tenantId, ...link })),
  });
}

export async function attachmentsByMessage(
  tenantId: string,
  messages: Array<{ id: string; batchId: string | null }>,
): Promise<Map<string, MessageAttachmentDto[]>> {
  const messageIds = messages.map((row) => row.id);
  const batchIds = [...new Set(messages.map((row) => row.batchId).filter((id): id is string => Boolean(id)))];
  const or: Prisma.MessageAttachmentLinkWhereInput[] = [];
  if (messageIds.length > 0) or.push({ messageId: { in: messageIds } });
  if (batchIds.length > 0) or.push({ batchId: { in: batchIds } });
  const out = new Map<string, MessageAttachmentDto[]>();
  for (const row of messages) out.set(row.id, []);
  if (or.length === 0) return out;
  const links = await prisma.messageAttachmentLink.findMany({
    where: { tenantId, OR: or, attachment: { tenantId } },
    orderBy: { sortOrder: 'asc' },
    select: {
      messageId: true,
      batchId: true,
      attachment: {
        select: {
          id: true,
          kind: true,
          fileName: true,
          sizeBytes: true,
          width: true,
          height: true,
          pageCount: true,
          thumbUrl: true,
          previewUrl: true,
          originalUrl: true,
          tenantId: true,
        },
      },
    },
  });
  const byMessage = new Map<string, MessageAttachmentDto[]>();
  const byBatch = new Map<string, MessageAttachmentDto[]>();
  for (const link of links) {
    if (link.attachment.tenantId !== tenantId) continue;
    const dto = toAttachmentDto(link.attachment);
    if (link.messageId) {
      const list = byMessage.get(link.messageId) ?? [];
      list.push(dto);
      byMessage.set(link.messageId, list);
    }
    if (link.batchId) {
      const list = byBatch.get(link.batchId) ?? [];
      list.push(dto);
      byBatch.set(link.batchId, list);
    }
  }
  for (const row of messages) {
    const own = byMessage.get(row.id);
    out.set(row.id, own && own.length > 0 ? own : row.batchId ? (byBatch.get(row.batchId) ?? []) : []);
  }
  return out;
}

export async function attachmentCountsFor(
  tenantId: string,
  messages: Array<{ id: string; batchId: string | null }>,
): Promise<Map<string, { imageCount: number; fileCount: number }>> {
  const grouped = await attachmentsByMessage(tenantId, messages);
  const counts = new Map<string, { imageCount: number; fileCount: number }>();
  for (const [id, items] of grouped) {
    counts.set(id, countAttachmentKinds(items.map((item) => item.kind)));
  }
  return counts;
}

export function previewForMessage(content: string, attachments: MessageAttachmentDto[]): string {
  const counts = countAttachmentKinds(attachments.map((item) => item.kind));
  return messageListPreview(content, counts.imageCount, counts.fileCount);
}

const STAFF_ROLES = ['ADMIN', 'MARKETER'] as const;

export async function noticeStats(
  tenantId: string,
  batchIds: string[],
): Promise<Map<string, { readCount: number; totalCount: number; hasAttachments: boolean }>> {
  const out = new Map<string, { readCount: number; totalCount: number; hasAttachments: boolean }>();
  if (batchIds.length === 0) return out;
  const [messages, links] = await Promise.all([
    prisma.message.findMany({
      where: { tenantId, batchId: { in: batchIds } },
      select: { batchId: true, readAt: true, attachmentsViewedAt: true },
    }),
    prisma.messageAttachmentLink.findMany({
      where: { tenantId, batchId: { in: batchIds } },
      select: { batchId: true },
    }),
  ]);
  const withFiles = new Set(links.map((link) => link.batchId).filter((id): id is string => Boolean(id)));
  for (const batchId of batchIds) {
    const rows = messages.filter((row) => row.batchId === batchId);
    const hasAttachments = withFiles.has(batchId);
    const readCount = rows.filter((row) =>
      noticeIsRead({ hasAttachments, readAt: row.readAt, attachmentsViewedAt: row.attachmentsViewedAt }),
    ).length;
    out.set(batchId, { readCount, totalCount: rows.length, hasAttachments });
  }
  return out;
}

export async function batchesWithAttachments(tenantId: string, batchIds: string[]): Promise<Set<string>> {
  if (batchIds.length === 0) return new Set();
  const links = await prisma.messageAttachmentLink.findMany({
    where: { tenantId, batchId: { in: batchIds } },
    select: { batchId: true },
  });
  return new Set(links.map((link) => link.batchId).filter((id): id is string => Boolean(id)));
}

export async function prepareThread<T extends {
  id: string;
  batchId: string | null;
  receiverId: string;
  sender: { role: string };
}>(
  tenantId: string,
  viewerRole: string,
  viewerId: string,
  messages: T[],
): Promise<{ messages: Array<T & { attachments: MessageAttachmentDto[]; isNotice: boolean; notice?: { batchId: string; readCount: number; totalCount: number } }>; deferIds: string[] }> {
  const files = await attachmentsByMessage(tenantId, messages);
  const noticeBatchIds = [
    ...new Set(
      messages
        .filter((row) => isBroadcastNotice({ batchId: row.batchId, senderRole: row.sender.role }))
        .map((row) => row.batchId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const stats =
    viewerRole === 'ADMIN' || viewerRole === 'MARKETER' ? await noticeStats(tenantId, noticeBatchIds) : new Map();
  const deferIds: string[] = [];
  const decorated = messages.map((row) => {
    const attachments = files.get(row.id) ?? [];
    const isNotice = isBroadcastNotice({ batchId: row.batchId, senderRole: row.sender.role });
    if (
      row.receiverId === viewerId &&
      deferReadUntilViewed({ batchId: row.batchId, senderRole: row.sender.role, hasAttachments: attachments.length > 0 })
    ) {
      deferIds.push(row.id);
    }
    const stat = row.batchId ? stats.get(row.batchId) : undefined;
    return {
      ...row,
      attachments,
      isNotice,
      ...(isNotice && stat && row.batchId ? { notice: { batchId: row.batchId, readCount: stat.readCount, totalCount: stat.totalCount } } : {}),
    };
  });
  return { messages: decorated, deferIds };
}

export async function markMessageAttachmentsViewed(tenantId: string, userId: string, messageId: string): Promise<void> {
  const row = await prisma.message.findFirst({
    where: { id: messageId, tenantId, receiverId: userId },
    select: { id: true },
  });
  if (!row) throw Object.assign(new Error('메시지를 찾을 수 없습니다.'), { status: 404 });
  const now = new Date();
  await prisma.message.updateMany({
    where: { id: messageId, tenantId, receiverId: userId },
    data: { attachmentsViewedAt: now, readAt: now },
  });
}

export async function listNotices(input: {
  tenantId: string;
  filter: 'all' | 'image' | 'file';
  q: string;
  cursor: string | null;
}) {
  const q = input.q.trim();
  const [messages, crew] = await Promise.all([
    prisma.message.findMany({
      where: {
        tenantId: input.tenantId,
        batchId: { not: null },
        sender: { role: { in: [...STAFF_ROLES] } },
        ...(q ? { content: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 4000,
      select: {
        batchId: true,
        content: true,
        createdAt: true,
        readAt: true,
        attachmentsViewedAt: true,
        sender: { select: { name: true } },
        receiver: { select: { role: true } },
      },
    }),
    prisma.crewStaffNotice.findMany({
      where: {
        group: { tenantId: input.tenantId },
        ...(q ? { content: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      select: {
        batchId: true,
        content: true,
        createdAt: true,
        readAt: true,
        attachmentsViewedAt: true,
        sender: { select: { name: true } },
      },
    }),
  ]);

  type Bucket = {
    batchId: string;
    content: string;
    createdAt: Date;
    senderName: string;
    targets: { teamLeaders: number; externalPartners: number; marketers: number; crewGroups: number };
    readRows: Array<{ readAt: Date | null; attachmentsViewedAt: Date | null }>;
    crewRows: Array<{ readAt: Date | null; attachmentsViewedAt: Date | null }>;
  };
  const buckets = new Map<string, Bucket>();
  for (const row of messages) {
    if (!row.batchId) continue;
    const bucket = buckets.get(row.batchId) ?? {
      batchId: row.batchId,
      content: row.content,
      createdAt: row.createdAt,
      senderName: row.sender.name,
      targets: { teamLeaders: 0, externalPartners: 0, marketers: 0, crewGroups: 0 },
      readRows: [],
      crewRows: [],
    };
    if (row.createdAt < bucket.createdAt) {
      bucket.createdAt = row.createdAt;
      bucket.content = row.content;
      bucket.senderName = row.sender.name;
    }
    if (row.receiver.role === 'TEAM_LEADER') bucket.targets.teamLeaders += 1;
    else if (row.receiver.role === 'EXTERNAL_PARTNER') bucket.targets.externalPartners += 1;
    else if (row.receiver.role === 'MARKETER') bucket.targets.marketers += 1;
    bucket.readRows.push(row);
    buckets.set(row.batchId, bucket);
  }
  for (const row of crew) {
    const bucket = buckets.get(row.batchId) ?? {
      batchId: row.batchId,
      content: row.content,
      createdAt: row.createdAt,
      senderName: row.sender.name,
      targets: { teamLeaders: 0, externalPartners: 0, marketers: 0, crewGroups: 0 },
      readRows: [],
      crewRows: [],
    };
    if (!buckets.has(row.batchId) || row.createdAt < bucket.createdAt) {
      bucket.createdAt = row.createdAt;
      bucket.content = row.content;
      bucket.senderName = row.sender.name;
    }
    bucket.targets.crewGroups += 1;
    bucket.crewRows.push(row);
    buckets.set(row.batchId, bucket);
  }

  const batchIds = [...buckets.keys()];
  const links = batchIds.length
    ? await prisma.messageAttachmentLink.findMany({
        where: { tenantId: input.tenantId, batchId: { in: batchIds }, attachment: { tenantId: input.tenantId } },
        orderBy: [{ batchId: 'asc' }, { sortOrder: 'asc' }],
        select: {
          batchId: true,
          attachment: {
            select: {
              id: true,
              kind: true,
              fileName: true,
              sizeBytes: true,
              width: true,
              height: true,
              pageCount: true,
              thumbUrl: true,
              previewUrl: true,
              originalUrl: true,
              tenantId: true,
            },
          },
        },
      })
    : [];
  const attachments = new Map<string, MessageAttachmentDto[]>();
  for (const link of links) {
    if (!link.batchId || link.attachment.tenantId !== input.tenantId) continue;
    const list = attachments.get(link.batchId) ?? [];
    list.push(toAttachmentDto(link.attachment));
    attachments.set(link.batchId, list);
  }

  const items = [...buckets.values()]
    .map((bucket) => {
      const files = attachments.get(bucket.batchId) ?? [];
      const hasAttachments = files.length > 0;
      return {
        batchId: bucket.batchId,
        content: bucket.content,
        createdAt: bucket.createdAt,
        senderName: bucket.senderName,
        targets: bucket.targets,
        attachments: files,
        read: {
          readCount: bucket.readRows.filter((row) => noticeIsRead({ hasAttachments, ...row })).length,
          totalCount: bucket.readRows.length,
        },
        crew: {
          readCount: bucket.crewRows.filter((row) => noticeIsRead({ hasAttachments, ...row })).length,
          totalCount: bucket.crewRows.length,
        },
        hasImage: files.some((file) => file.kind === 'image'),
        hasFile: files.some((file) => file.kind === 'pdf'),
      };
    })
    .filter((item) => {
      if (input.filter === 'image') return item.hasImage;
      if (input.filter === 'file') return item.hasFile;
      return true;
    });

  const paged = pageAfterCursor(items, input.cursor);
  return {
    items: paged.page.map(({ hasImage: _image, hasFile: _file, ...item }) => item),
    nextCursor: paged.nextCursor,
  };
}

export async function noticeReaders(tenantId: string, batchId: string) {
  const [messages, crew, link] = await Promise.all([
    prisma.message.findMany({
      where: { tenantId, batchId, sender: { role: { in: [...STAFF_ROLES] } } },
      select: {
        readAt: true,
        attachmentsViewedAt: true,
        receiver: { select: { id: true, name: true, role: true } },
      },
    }),
    prisma.crewStaffNotice.findMany({
      where: { batchId, group: { tenantId } },
      select: {
        readAt: true,
        attachmentsViewedAt: true,
        crewGroupId: true,
        group: { select: { name: true } },
      },
    }),
    prisma.messageAttachmentLink.findFirst({
      where: { tenantId, batchId },
      select: { id: true },
    }),
  ]);
  if (messages.length === 0 && crew.length === 0) return null;
  const hasAttachments = link != null;
  const read = [];
  const unread = [];
  for (const row of messages) {
    const person = { userId: row.receiver.id, name: row.receiver.name, role: row.receiver.role };
    const at = noticeReadAt({ hasAttachments, readAt: row.readAt, attachmentsViewedAt: row.attachmentsViewedAt });
    if (at) read.push({ ...person, readAt: at });
    else unread.push(person);
  }
  return {
    read,
    unread,
    crew: crew.map((row) => ({
      crewGroupId: row.crewGroupId,
      name: row.group.name,
      readAt: noticeReadAt({ hasAttachments, readAt: row.readAt, attachmentsViewedAt: row.attachmentsViewedAt }),
    })),
  };
}

let remindSender: typeof notifyMessageInboxRefresh = notifyMessageInboxRefresh;

/** 테스트에서 실제 휴대폰 알림 대신 기록만 하게 바꾼다. */
export function setMessageNoticeRemindSender(next: typeof notifyMessageInboxRefresh | null): void {
  remindSender = next ?? notifyMessageInboxRefresh;
}

export async function remindNotice(tenantId: string, batchId: string, actorId: string, actorRole: string) {
  const now = new Date();
  const [sample, crewSample, files, remind] = await Promise.all([
    prisma.message.findFirst({
      where: { tenantId, batchId, sender: { role: { in: [...STAFF_ROLES] } } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, content: true, sender: { select: { name: true } } },
    }),
    prisma.crewStaffNotice.findFirst({
      where: { batchId, group: { tenantId } },
      select: { content: true, sender: { select: { name: true } } },
    }),
    prisma.messageAttachmentLink.findMany({
      where: { tenantId, batchId, attachment: { tenantId } },
      select: { attachment: { select: { kind: true } } },
    }),
    prisma.messageNoticeRemind.findFirst({
      where: { tenantId, batchId },
      select: { remindedAt: true },
    }),
  ]);
  if (!sample && !crewSample) throw Object.assign(new Error('공지를 찾을 수 없습니다.'), { status: 404 });
  const blocked = remindBlockMinutes(remind?.remindedAt ?? null, now);
  if (blocked != null) {
    throw Object.assign(new Error(`같은 공지는 ${blocked}분 뒤에 다시 알릴 수 있어요.`), {
      status: 429,
      retryAfterMinutes: blocked,
    });
  }
  const hasAttachments = files.length > 0;
  const messages = await prisma.message.findMany({
    where: { tenantId, batchId },
    select: { receiverId: true, readAt: true, attachmentsViewedAt: true },
  });
  const unreadIds = messages
    .filter((row) => !noticeIsRead({ hasAttachments, readAt: row.readAt, attachmentsViewedAt: row.attachmentsViewedAt }))
    .map((row) => row.receiverId);
  const unreadCrew = await prisma.crewStaffNotice.findMany({
    where: { batchId, group: { tenantId } },
    select: { crewGroupId: true, readAt: true, attachmentsViewedAt: true },
  });
  const crewIds = unreadCrew
    .filter((row) => !noticeIsRead({ hasAttachments, readAt: row.readAt, attachmentsViewedAt: row.attachmentsViewedAt }))
    .map((row) => row.crewGroupId);
  const remindedCount = new Set(unreadIds).size + new Set(crewIds).size;
  if (remindedCount === 0) return { remindedCount: 0 };
  await prisma.messageNoticeRemind.upsert({
    where: { tenantId_batchId: { tenantId, batchId } },
    create: { tenantId, batchId, remindedAt: now },
    update: { remindedAt: now },
  });
  const counts = countAttachmentKinds(files.map((file) => file.attachment.kind));
  const content = sample?.content ?? crewSample?.content ?? '';
  const senderName = sample?.sender.name ?? crewSample?.sender.name ?? '관리자';
  if (unreadIds.length > 0) {
    await remindSender({
      senderId: actorId,
      senderName,
      senderRole: actorRole,
      receiverIds: [...new Set(unreadIds)],
      messageId: sample?.id ?? '',
      preview: messageListPreview(content, counts.imageCount, counts.fileCount),
      title: '현장 공지',
    });
  }
  if (crewIds.length > 0) notifyCrewGroupsInboxRefresh([...new Set(crewIds)]);
  return { remindedCount };
}

export async function listTeamNotices(tenantId: string, userId: string, cursor: string | null) {
  const rows = await prisma.message.findMany({
    where: {
      tenantId,
      receiverId: userId,
      batchId: { not: null },
      sender: { role: { in: [...STAFF_ROLES] } },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
    select: {
      id: true,
      batchId: true,
      content: true,
      createdAt: true,
      sender: { select: { name: true } },
    },
  });
  const seen = new Set<string>();
  const collapsed = [];
  for (const row of rows) {
    if (!row.batchId || seen.has(row.batchId)) continue;
    seen.add(row.batchId);
    collapsed.push(row);
  }
  const paged = pageAfterCursor(
    collapsed.map((row) => ({ ...row, batchId: row.batchId as string })),
    cursor,
  );
  const files = await attachmentsByMessage(
    tenantId,
    paged.page.map((row) => ({ id: row.id, batchId: row.batchId })),
  );
  return {
    items: paged.page.map((row) => ({
      batchId: row.batchId,
      messageId: row.id,
      content: row.content,
      createdAt: row.createdAt,
      senderName: row.sender.name,
      attachments: files.get(row.id) ?? [],
    })),
    nextCursor: paged.nextCursor,
  };
}

export async function listCrewNoticeArchive(tenantId: string, crewGroupId: string, cursor: string | null) {
  const group = await prisma.teamCrewGroup.findFirst({
    where: { id: crewGroupId, tenantId },
    select: { id: true },
  });
  if (!group) return { items: [], nextCursor: null };
  const rows = await prisma.crewStaffNotice.findMany({
    where: { crewGroupId, group: { tenantId } },
    orderBy: { createdAt: 'desc' },
    take: 1000,
    select: {
      id: true,
      batchId: true,
      content: true,
      createdAt: true,
      sender: { select: { name: true } },
    },
  });
  const paged = pageAfterCursor(rows, cursor);
  const batchIds = paged.page.map((row) => row.batchId);
  const links = batchIds.length
    ? await prisma.messageAttachmentLink.findMany({
        where: { tenantId, batchId: { in: batchIds }, attachment: { tenantId } },
        orderBy: { sortOrder: 'asc' },
        select: {
          batchId: true,
          attachment: {
            select: {
              id: true,
              kind: true,
              fileName: true,
              sizeBytes: true,
              width: true,
              height: true,
              pageCount: true,
              thumbUrl: true,
              previewUrl: true,
              originalUrl: true,
              tenantId: true,
            },
          },
        },
      })
    : [];
  const byBatch = new Map<string, MessageAttachmentDto[]>();
  for (const link of links) {
    if (!link.batchId || link.attachment.tenantId !== tenantId) continue;
    const list = byBatch.get(link.batchId) ?? [];
    list.push(toAttachmentDto(link.attachment));
    byBatch.set(link.batchId, list);
  }
  return {
    items: paged.page.map((row) => ({
      batchId: row.batchId,
      messageId: row.id,
      content: row.content,
      createdAt: row.createdAt,
      senderName: row.sender.name,
      attachments: byBatch.get(row.batchId) ?? [],
    })),
    nextCursor: paged.nextCursor,
  };
}

export async function markCrewNoticeViewed(tenantId: string, crewGroupId: string, noticeId: string): Promise<void> {
  const row = await prisma.crewStaffNotice.findFirst({
    where: { id: noticeId, crewGroupId, group: { tenantId } },
    select: { id: true },
  });
  if (!row) throw Object.assign(new Error('공지를 찾을 수 없습니다.'), { status: 404 });
  const now = new Date();
  await prisma.crewStaffNotice.updateMany({
    where: { id: noticeId, crewGroupId },
    data: { attachmentsViewedAt: now, readAt: now },
  });
}

export async function markCrewNoticesOpened(tenantId: string, crewGroupId: string, noticeIds: string[]): Promise<Date | null> {
  if (noticeIds.length === 0) return null;
  const owned = await prisma.crewStaffNotice.findMany({
    where: { id: { in: noticeIds }, crewGroupId, group: { tenantId }, readAt: null },
    select: { id: true },
  });
  if (owned.length === 0) return null;
  const now = new Date();
  await prisma.crewStaffNotice.updateMany({
    where: { id: { in: owned.map((row) => row.id) }, crewGroupId, readAt: null },
    data: { readAt: now },
  });
  return now;
}

export async function purgeOrphanMessageAttachments(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ATTACHMENT_ORPHAN_MS);
  const rows = await prisma.messageAttachment.findMany({
    where: { createdAt: { lt: cutoff }, links: { none: {} } },
    select: { id: true, tenantId: true, storageKey: true, createdAt: true },
    take: 100,
  });
  let removed = 0;
  for (const row of rows) {
    if (!isOrphanAttachment(row.createdAt, 0, now)) continue;
    const still = await prisma.messageAttachmentLink.count({
      where: { tenantId: row.tenantId, attachmentId: row.id },
    });
    if (still > 0) continue;
    for (const key of row.storageKey.split('\n')) {
      const id = key.trim();
      if (!id) continue;
      await destroyStoredObject(id, id.endsWith('.pdf') || id.includes('.pdf') ? 'raw' : 'image');
    }
    const deleted = await prisma.messageAttachment.deleteMany({
      where: { id: row.id, tenantId: row.tenantId, links: { none: {} } },
    });
    removed += deleted.count;
  }
  return removed;
}

export function startMessageAttachmentCleanup(): void {
  const hour = 60 * 60 * 1000;
  const run = () => {
    void purgeOrphanMessageAttachments().catch((error) => {
      console.warn('[messages] orphan attachment cleanup failed', error instanceof Error ? error.message : '');
    });
  };
  setTimeout(run, 60_000).unref();
  setInterval(run, hour).unref();
}
