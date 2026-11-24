import { API } from './apiPrefix';
import { withTeamPreviewQuery } from '../utils/teamPreviewQuery';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function getConversations(token: string) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${API}/messages/conversations`, {
      headers: headers(token),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error('대화 목록을 불러올 수 없습니다.');
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getUnreadCount(token: string) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${API}/messages/unread-count`, {
      headers: headers(token),
      signal: ctrl.signal,
    });
    if (!res.ok) return { count: 0 };
    return res.json();
  } catch {
    return { count: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getMessages(token: string, userId: string) {
  const res = await fetch(`${API}/messages/${userId}`, { headers: headers(token) });
  if (!res.ok) throw new Error('메시지를 불러올 수 없습니다.');
  return res.json();
}

/** 팀장: 운영 측과 통합 대화 (한 화면) */
export async function getTeamOfficeMessages(token: string) {
  const res = await fetch(withTeamPreviewQuery(`${API}/messages/team-office`), { headers: headers(token) });
  if (!res.ok) throw new Error('메시지를 불러올 수 없습니다.');
  return res.json();
}

/** 팀장: 재직 관리자·마케터 전원에게 동일 내용 전송 */
export async function sendTeamToManagement(token: string, content: string) {
  const res = await fetch(withTeamPreviewQuery(`${API}/messages/team-send`), {
    method: 'POST',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === 'string' ? err.error : '전송에 실패했습니다.');
  }
  return res.json() as Promise<{ batchId: string; recipientCount: number }>;
}

export type BroadcastToFieldTargets = {
  toTeamLeaders: boolean;
  toExternalPartners: boolean;
  toCrew: boolean;
  toMarketers?: boolean;
};

/** 관리자·마케터: 현장(팀장·외부업체·크루) 대상 공지 — 대상은 플래그로 선택 */
export async function broadcastToField(
  token: string,
  content: string,
  targets: BroadcastToFieldTargets,
  attachmentIds?: string[],
) {
  const res = await fetch(`${API}/messages/broadcast-to-leaders`, {
    method: 'POST',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      toTeamLeaders: targets.toTeamLeaders,
      toExternalPartners: targets.toExternalPartners,
      toCrew: targets.toCrew,
      toMarketers: targets.toMarketers === true,
      ...(attachmentIds && attachmentIds.length > 0 ? { attachmentIds } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === 'string' ? err.error : '전송에 실패했습니다.');
  }
  return res.json() as Promise<{ batchId: string; recipientCount: number; crewNoticeCount: number }>;
}

export async function sendMessage(
  token: string,
  receiverId: string,
  content: string,
  attachmentIds?: string[],
) {
  const res = await fetch(`${API}/messages`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      receiverId,
      content,
      ...(attachmentIds && attachmentIds.length > 0 ? { attachmentIds } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '전송에 실패했습니다.');
  }
  return res.json();
}

/* ───────── 사진·파일 붙이기, 공지 읽음, 공지 모아보기 ───────── */

export type MessageAttachment = {
  id: string;
  kind: 'image' | 'pdf';
  fileName: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  pageCount?: number | null;
  thumbUrl?: string | null;
  previewUrl?: string | null;
  originalUrl: string;
};

export type MessageNoticeRead = { batchId: string; readCount: number; totalCount: number };

export const MESSAGE_ATTACH_MAX_IMAGES = 30;
export const MESSAGE_ATTACH_MAX_PDFS = 5;
export const MESSAGE_ATTACH_MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MESSAGE_ATTACH_MAX_PDF_BYTES = 20 * 1024 * 1024;

async function errorText(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({}));
  return typeof err?.error === 'string' ? err.error : fallback;
}

/** 사진·PDF 한 개 올리기 — 원본 그대로 보관된다. */
export async function uploadMessageAttachment(token: string, file: File): Promise<MessageAttachment> {
  const form = new FormData();
  form.append('files', file, file.name);
  const res = await fetch(`${API}/messages/attachments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await errorText(res, '파일을 올리지 못했습니다.'));
  const data = (await res.json()) as { attachments?: MessageAttachment[] };
  const first = data.attachments?.[0];
  if (!first) throw new Error('파일을 올리지 못했습니다.');
  return first;
}

/** 받는 사람이 사진·파일을 열어 봤음을 알린다(읽음 처리). 실패해도 화면은 그대로 둔다. */
export async function markMessageAttachmentsViewed(token: string, messageId: string): Promise<void> {
  try {
    await fetch(withTeamPreviewQuery(`${API}/messages/attachments/viewed`), {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ messageId }),
    });
  } catch {
    /* 다음에 열 때 다시 보낸다 */
  }
}

export type NoticeArchiveItem = {
  batchId: string;
  content: string;
  createdAt: string;
  senderName: string;
  targets?: { teamLeaders?: number; externalPartners?: number; marketers?: number; crewGroups?: number };
  attachments: MessageAttachment[];
  read?: { readCount: number; totalCount: number };
  crew?: { readCount: number; totalCount: number };
};

export async function listNotices(
  token: string,
  opts: { filter?: 'all' | 'image' | 'file'; q?: string; cursor?: string | null } = {},
): Promise<{ items: NoticeArchiveItem[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  qs.set('filter', opts.filter ?? 'all');
  if (opts.q?.trim()) qs.set('q', opts.q.trim());
  if (opts.cursor) qs.set('cursor', opts.cursor);
  const res = await fetch(`${API}/messages/notices?${qs.toString()}`, { headers: headers(token) });
  if (!res.ok) throw new Error(await errorText(res, '공지 목록을 불러오지 못했습니다.'));
  const data = await res.json();
  return { items: Array.isArray(data?.items) ? data.items : [], nextCursor: data?.nextCursor ?? null };
}

export type NoticeReaders = {
  read: { userId: string; name: string; role: string; readAt: string }[];
  unread: { userId: string; name: string; role: string }[];
  crew: { crewGroupId: string; name: string; readAt: string | null }[];
};

export async function getNoticeReaders(token: string, batchId: string): Promise<NoticeReaders> {
  const res = await fetch(`${API}/messages/notices/${encodeURIComponent(batchId)}/readers`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await errorText(res, '읽음 현황을 불러오지 못했습니다.'));
  const data = await res.json();
  return {
    read: Array.isArray(data?.read) ? data.read : [],
    unread: Array.isArray(data?.unread) ? data.unread : [],
    crew: Array.isArray(data?.crew) ? data.crew : [],
  };
}

export async function remindNotice(token: string, batchId: string): Promise<{ remindedCount: number }> {
  const res = await fetch(`${API}/messages/notices/${encodeURIComponent(batchId)}/remind`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await errorText(res, '알림을 다시 보내지 못했습니다.'));
  return res.json();
}

export type TeamNoticeItem = {
  batchId: string;
  messageId?: string;
  content: string;
  createdAt: string;
  senderName: string;
  attachments: MessageAttachment[];
};

/** 팀장·외부업체: 내가 받은 공지 모아보기 */
export async function listTeamNotices(
  token: string,
  cursor?: string | null,
): Promise<{ items: TeamNoticeItem[]; nextCursor: string | null }> {
  const base = `${API}/messages/team-notices${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`;
  const res = await fetch(withTeamPreviewQuery(base), { headers: headers(token) });
  if (!res.ok) throw new Error(await errorText(res, '공지를 불러오지 못했습니다.'));
  const data = await res.json();
  return { items: Array.isArray(data?.items) ? data.items : [], nextCursor: data?.nextCursor ?? null };
}
