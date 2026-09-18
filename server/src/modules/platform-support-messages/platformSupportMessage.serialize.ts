import type { PlatformSupportSenderKind } from '@prisma/client';

export type PlatformSupportMessageDto = {
  id: string;
  body: string;
  senderKind: PlatformSupportSenderKind;
  senderName: string;
  senderRoleLabel: string | null;
  broadcastBatchId: string | null;
  createdAt: string;
};

export type PlatformSupportThreadDto = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  lastSenderKind: PlatformSupportSenderKind | null;
  waitingOn: 'PLATFORM' | 'TENANT' | null;
  unreadCount: number;
  messages: PlatformSupportMessageDto[];
};

export function serializeSupportMessage(row: {
  id: string;
  body: string;
  senderKind: PlatformSupportSenderKind;
  broadcastBatchId: string | null;
  createdAt: Date;
  senderPlatformUser: { name: string } | null;
  senderUser: { name: string; role: string } | null;
}): PlatformSupportMessageDto {
  const isPlatform = row.senderKind === 'PLATFORM';
  const senderName = isPlatform
    ? row.senderPlatformUser?.name?.trim() || '청소비서 운영팀'
    : row.senderUser?.name?.trim() || '업체';
  const senderRoleLabel = isPlatform
    ? '운영팀'
    : row.senderUser?.role === 'MARKETER'
      ? '마케터'
      : row.senderUser?.role === 'ADMIN'
        ? '관리자'
        : null;
  return {
    id: row.id,
    body: row.body,
    senderKind: row.senderKind,
    senderName,
    senderRoleLabel,
    broadcastBatchId: row.broadcastBatchId,
    createdAt: row.createdAt.toISOString(),
  };
}
