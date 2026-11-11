import { API } from './apiPrefix';
import { getPlatformToken } from '../stores/platformAuth';

export type PlatformBoardType = 'NOTICE' | 'INQUIRY';
export type PlatformBoardPostStatus = 'OPEN' | 'ANSWERED' | 'HIDDEN';

export type PlatformBoardReplyInbox = {
  email: string;
  host: string;
  port: number;
  passwordConfigured: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
};

export type PlatformBoardSettings = {
  notifyEmail?: string;
  notifyEmails?: string[];
  contactEmail?: string;
  composeHelpText?: string | null;
  maskAuthorNames?: boolean;
  replyInbox?: PlatformBoardReplyInbox | null;
};

/** 저장할 때만 — 비밀번호는 비우면 그대로 둔다 */
export type PlatformBoardSettingsPatch = Omit<PlatformBoardSettings, 'replyInbox'> & {
  replyInbox?: { email: string; host?: string; port?: number; password?: string } | null;
};

export type PlatformBoardReply = {
  id: string;
  authorType: 'ADMIN' | 'CUSTOMER';
  source: 'PLATFORM' | 'EMAIL';
  bodyHtml: string;
  createdAt: string;
  fromEmail?: string | null;
  emailSentAt?: string | null;
  emailError?: string | null;
};

export type PlatformBoard = {
  id: string;
  slug: string;
  label: string;
  boardType: PlatformBoardType;
  sortOrder: number;
  isPublished: boolean;
  listPublic: boolean;
  settings: PlatformBoardSettings;
  categoryCount: number;
  postCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PlatformBoardCategory = {
  id: string;
  boardId: string;
  slug: string;
  label: string;
  sortOrder: number;
  postCount: number;
};

export type PlatformBoardPost = {
  id: string;
  boardId: string;
  boardSlug: string;
  boardLabel: string;
  boardType: PlatformBoardType;
  categoryId: string | null;
  categorySlug: string | null;
  categoryLabel: string | null;
  slug: string | null;
  title: string;
  excerpt: string | null;
  bodyHtml: string | null;
  authorName: string | null;
  authorEmail: string | null;
  authorUserId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  isSecret: boolean;
  status: PlatformBoardPostStatus;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  viewCount: number;
  thumbnailUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  /** 플랫폼 화면에서만 */
  authorPhone?: string | null;
  replyToken?: string | null;
  privacyConsentAt?: string | null;
  replies?: PlatformBoardReply[];
};

function headers(json = true) {
  const token = getPlatformToken();
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function fetchPlatformCustomerBoards(): Promise<PlatformBoard[]> {
  const res = await fetch(`${API}/platform/customer-boards/boards`, { headers: headers(false) });
  if (!res.ok) throw new Error('게시판 목록을 불러오지 못했습니다.');
  const data = (await res.json()) as { items: PlatformBoard[] };
  return data.items;
}

export async function fetchPlatformCustomerBoard(slug: string): Promise<PlatformBoard> {
  const res = await fetch(`${API}/platform/customer-boards/boards/${encodeURIComponent(slug)}`, {
    headers: headers(false),
  });
  if (!res.ok) throw new Error('게시판 정보를 불러오지 못했습니다.');
  const data = (await res.json()) as { item: PlatformBoard };
  return data.item;
}

export async function updatePlatformCustomerBoard(
  slug: string,
  body: Partial<Pick<PlatformBoard, 'label' | 'isPublished' | 'listPublic'>> & {
    settings?: PlatformBoardSettingsPatch;
  },
): Promise<PlatformBoard> {
  const res = await fetch(`${API}/platform/customer-boards/boards/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? '저장에 실패했습니다.');
  }
  const data = (await res.json()) as { item: PlatformBoard };
  return data.item;
}

export async function fetchPlatformCustomerBoardCategories(slug: string): Promise<PlatformBoardCategory[]> {
  const res = await fetch(`${API}/platform/customer-boards/boards/${encodeURIComponent(slug)}/categories`, {
    headers: headers(false),
  });
  if (!res.ok) throw new Error('카테고리를 불러오지 못했습니다.');
  const data = (await res.json()) as { items: PlatformBoardCategory[] };
  return data.items;
}

export async function createPlatformCustomerBoardCategory(
  boardSlug: string,
  body: { slug?: string; label: string; sortOrder?: number },
): Promise<PlatformBoardCategory> {
  const res = await fetch(
    `${API}/platform/customer-boards/boards/${encodeURIComponent(boardSlug)}/categories`,
    { method: 'POST', headers: headers(), body: JSON.stringify(body) },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? '카테고리 추가에 실패했습니다.');
  }
  const data = (await res.json()) as { item: PlatformBoardCategory };
  return data.item;
}

export async function updatePlatformCustomerBoardCategory(
  boardSlug: string,
  categoryId: string,
  body: { label?: string; sortOrder?: number },
): Promise<PlatformBoardCategory> {
  const res = await fetch(
    `${API}/platform/customer-boards/boards/${encodeURIComponent(boardSlug)}/categories/${encodeURIComponent(categoryId)}`,
    { method: 'PATCH', headers: headers(), body: JSON.stringify(body) },
  );
  if (!res.ok) throw new Error('카테고리 수정에 실패했습니다.');
  const data = (await res.json()) as { item: PlatformBoardCategory };
  return data.item;
}

export async function deletePlatformCustomerBoardCategory(boardSlug: string, categoryId: string): Promise<void> {
  const res = await fetch(
    `${API}/platform/customer-boards/boards/${encodeURIComponent(boardSlug)}/categories/${encodeURIComponent(categoryId)}`,
    { method: 'DELETE', headers: headers(false) },
  );
  if (!res.ok) throw new Error('카테고리 삭제에 실패했습니다.');
}

export async function fetchPlatformCustomerBoardPosts(params: {
  boardSlug?: string;
  categoryId?: string;
  status?: PlatformBoardPostStatus;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: PlatformBoardPost[]; total: number }> {
  const sp = new URLSearchParams();
  if (params.boardSlug) sp.set('boardSlug', params.boardSlug);
  if (params.categoryId) sp.set('categoryId', params.categoryId);
  if (params.status) sp.set('status', params.status);
  if (params.q) sp.set('q', params.q);
  sp.set('limit', String(params.limit ?? 30));
  sp.set('offset', String(params.offset ?? 0));
  const res = await fetch(`${API}/platform/customer-boards/posts?${sp}`, { headers: headers(false) });
  if (!res.ok) throw new Error('글 목록을 불러오지 못했습니다.');
  return res.json() as Promise<{ items: PlatformBoardPost[]; total: number }>;
}

export async function fetchPlatformCustomerBoardPost(id: string): Promise<PlatformBoardPost> {
  const res = await fetch(`${API}/platform/customer-boards/posts/${encodeURIComponent(id)}`, {
    headers: headers(false),
  });
  if (!res.ok) throw new Error('글을 불러오지 못했습니다.');
  const data = (await res.json()) as { post: PlatformBoardPost };
  return data.post;
}

export async function createPlatformCustomerBoardPost(
  boardSlug: string,
  body: {
    categoryId?: string | null;
    title: string;
    excerpt?: string | null;
    bodyHtml: string;
    slug?: string | null;
    isPinned?: boolean;
    isPublished?: boolean;
  },
): Promise<PlatformBoardPost> {
  const res = await fetch(
    `${API}/platform/customer-boards/boards/${encodeURIComponent(boardSlug)}/posts`,
    { method: 'POST', headers: headers(), body: JSON.stringify(body) },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? '등록에 실패했습니다.');
  }
  const data = (await res.json()) as { post: PlatformBoardPost };
  return data.post;
}

export async function updatePlatformCustomerBoardPost(
  id: string,
  body: Partial<{
    categoryId: string | null;
    title: string;
    excerpt: string | null;
    bodyHtml: string;
    slug: string | null;
    isPinned: boolean;
    isPublished: boolean;
    status: PlatformBoardPostStatus;
    isSecret: boolean;
  }>,
): Promise<PlatformBoardPost> {
  const res = await fetch(`${API}/platform/customer-boards/posts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? '저장에 실패했습니다.');
  }
  const data = (await res.json()) as { post: PlatformBoardPost };
  return data.post;
}

export async function deletePlatformCustomerBoardPost(id: string): Promise<void> {
  const res = await fetch(`${API}/platform/customer-boards/posts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(false),
  });
  if (!res.ok) throw new Error('삭제에 실패했습니다.');
}

export async function uploadPlatformCustomerBoardFile(
  boardSlug: string,
  file: File,
): Promise<{ url: string; fileName: string; kind: 'image' | 'file' }> {
  const token = getPlatformToken();
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(
    `${API}/platform/customer-boards/boards/${encodeURIComponent(boardSlug)}/upload`,
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? '파일 업로드에 실패했습니다.');
  }
  const data = (await res.json()) as { url: string; fileName?: string; kind?: 'image' | 'file' };
  return {
    url: data.url,
    fileName: data.fileName || file.name,
    kind: data.kind === 'file' ? 'file' : 'image',
  };
}

export async function uploadPlatformCustomerBoardImage(boardSlug: string, file: File): Promise<string> {
  const uploaded = await uploadPlatformCustomerBoardFile(boardSlug, file);
  return uploaded.url;
}

async function postJson<T>(url: string, body: unknown, fallback: string): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body ?? {}) });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? fallback);
  }
  return res.json() as Promise<T>;
}

/** 답변 쓰기 → 고객 메일 */
export async function createPlatformCustomerBoardReply(postId: string, bodyHtml: string): Promise<PlatformBoardReply> {
  const data = await postJson<{ reply: PlatformBoardReply }>(
    `${API}/platform/customer-boards/posts/${encodeURIComponent(postId)}/replies`,
    { bodyHtml },
    '답변을 저장하지 못했어요.',
  );
  return data.reply;
}

export async function resendPlatformCustomerBoardReply(postId: string, replyId: string): Promise<PlatformBoardReply> {
  const data = await postJson<{ reply: PlatformBoardReply }>(
    `${API}/platform/customer-boards/posts/${encodeURIComponent(postId)}/replies/${encodeURIComponent(replyId)}/resend`,
    {},
    '메일을 다시 보내지 못했어요.',
  );
  return data.reply;
}

export async function testPlatformReplyInbox(
  boardSlug: string,
  body: { email: string; host?: string; port?: number; password?: string },
): Promise<void> {
  await postJson<{ ok: true }>(
    `${API}/platform/customer-boards/boards/${encodeURIComponent(boardSlug)}/reply-inbox/test`,
    body,
    '연결을 확인하지 못했어요.',
  );
}

export type ReplyInboxPullResult = {
  scanned: number;
  answers: number;
  followups: number;
  skipped: number;
  unknownSenders: number;
};

export async function pullPlatformReplyInbox(boardSlug: string): Promise<ReplyInboxPullResult> {
  return postJson<ReplyInboxPullResult>(
    `${API}/platform/customer-boards/boards/${encodeURIComponent(boardSlug)}/reply-inbox/pull`,
    {},
    '메일을 가져오지 못했어요.',
  );
}
