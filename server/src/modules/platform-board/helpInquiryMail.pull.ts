/**
 * 「답장 받는 메일함」(IMAP)에서 1:1 문의 답장을 가져온다.
 * - 안 읽은 메일 중 제목에 #번호가 있는 것만 본다. 없으면 건드리지 않는다.
 * - 담당자(운영 알림 메일 + 게시판 알림 메일) → 답변 저장 + 고객 메일, 작성자 → 추가 질문 + 담당자 알림, 그 외 → 로그만.
 * - 처리한 메일은 읽음 표시 후 「청소비서처리됨」 폴더로 옮긴다.
 */
import { simpleParser } from 'mailparser';
import { ImapFlow } from 'imapflow';
import { prisma } from '../../lib/prisma.js';
import { decryptTenantSecret } from '../../lib/tenantSecretCrypto.js';
import { parseReplyInboxStored, type PlatformBoardReplyInboxStored } from './platformBoard.helpers.js';
import { setReplyInboxStatus } from './platformBoard.service.js';
import { applyInboundInquiryMail, resolveInquiryStaffEmails } from './platformBoardReply.service.js';
import {
  classifyInquirySender,
  extractReplyToken,
  htmlToPlainText,
  stripQuotedReply,
} from './platformBoardInquiry.helpers.js';

export const PROCESSED_FOLDER = '청소비서처리됨';
const MAX_PER_RUN = 40;

function imapErrorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  if (/auth|login|invalid credentials|authentication|AUTHENTICATIONFAILED/i.test(msg)) {
    return '메일함 로그인에 실패했어요. IMAP 사용을 켜고, 2단계 인증이면 앱 비밀번호를 넣어 주세요.';
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) return 'IMAP 서버 주소를 찾지 못했어요.';
  if (/timed? ?out|ETIMEDOUT|ECONNREFUSED/i.test(msg)) return 'IMAP 서버에 연결하지 못했어요. 서버·포트를 확인해 주세요.';
  return '메일함에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

function newClient(box: { email: string; host: string; port: number }, password: string): ImapFlow {
  return new ImapFlow({
    host: box.host,
    port: box.port,
    secure: box.port === 993,
    auth: { user: box.email, pass: password },
    logger: false,
    socketTimeout: 60_000,
  });
}

/** 「연결 확인」 — 저장 전 입력값 또는 저장된 비밀번호로 로그인만 해 본다 */
export async function testReplyInbox(input: {
  email: string;
  host: string;
  port: number;
  password?: string;
  storedPassEnc?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const password = input.password || (input.storedPassEnc ? decryptTenantSecret(input.storedPassEnc) : null);
  if (!password) return { ok: false, error: '앱 비밀번호를 넣어 주세요.' };
  const client = newClient(input, password);
  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: imapErrorText(e) };
  }
}

async function ensureProcessedFolder(client: ImapFlow): Promise<string | null> {
  try {
    const list = await client.list();
    const hit = list.find((m) => m.name === PROCESSED_FOLDER || m.path === PROCESSED_FOLDER);
    if (hit) return hit.path;
    const created = await client.mailboxCreate(PROCESSED_FOLDER);
    return created.path;
  } catch (e) {
    console.warn('[help-inquiry-mail] processed folder unavailable', e instanceof Error ? e.message : 'error');
    return null;
  }
}

async function markHandled(client: ImapFlow, uid: number, folder: string | null): Promise<void> {
  try {
    await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
    if (folder) await client.messageMove(String(uid), folder, { uid: true });
  } catch (e) {
    console.warn('[help-inquiry-mail] mark handled failed', uid, e instanceof Error ? e.message : 'error');
  }
}

export type PullResult = {
  scanned: number;
  answers: number;
  followups: number;
  skipped: number;
  unknownSenders: number;
};

async function pullBoardInbox(
  board: { id: string; settings: unknown },
  box: PlatformBoardReplyInboxStored,
): Promise<PullResult> {
  const result: PullResult = { scanned: 0, answers: 0, followups: 0, skipped: 0, unknownSenders: 0 };
  const password = box.passEnc ? decryptTenantSecret(box.passEnc) : null;
  if (!password) {
    await setReplyInboxStatus(board.id, {
      lastSyncAt: new Date(),
      lastError: '저장된 앱 비밀번호를 읽지 못했어요. 다시 저장해 주세요.',
    });
    return result;
  }
  const notifyEmails = await resolveInquiryStaffEmails(board.settings);
  const client = newClient(box, password);
  try {
    await client.connect();
    const folder = await ensureProcessedFolder(client);
    const lock = await client.getMailboxLock('INBOX');
    try {
      const found = await client.search({ seen: false }, { uid: true });
      const uids = (Array.isArray(found) ? found : []).slice(0, MAX_PER_RUN);
      for (const uid of uids) {
        // 제목만 먼저 본다 — 번호 없는 메일은 본문을 열지 않고 그대로 둔다(읽음 표시 안 함)
        const head = await client.fetchOne(String(uid), { envelope: true }, { uid: true });
        if (!head) continue;
        const token = extractReplyToken(head.envelope?.subject ?? '');
        if (!token) continue;
        const msg = await client.fetchOne(String(uid), { envelope: true, source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        result.scanned += 1;

        const parsed = await simpleParser(msg.source);
        const fromEmail = (parsed.from?.value?.[0]?.address ?? msg.envelope?.from?.[0]?.address ?? '').trim();
        const messageId = (parsed.messageId || `imap:${box.email}:${uid}`).slice(0, 512);
        const post = await prisma.platformBoardPost.findFirst({
          where: { replyToken: token, boardId: board.id },
          select: { id: true, authorEmail: true },
        });
        if (!post) {
          // 다른 서버(staging·운영)가 같은 메일함을 볼 수 있다 — 내 문의가 아니면 건드리지 않는다
          result.skipped += 1;
          continue;
        }
        const kind = classifyInquirySender(fromEmail, notifyEmails, post.authorEmail);
        if (kind === 'UNKNOWN') {
          // 모르는 발신자 — 저장·전달하지 않고 로그만(주소는 남기지 않는다)
          console.warn('[help-inquiry-mail] 모르는 발신자 — 무시', { token, domain: fromEmail.split('@')[1] ?? '' });
          result.unknownSenders += 1;
          await markHandled(client, uid, folder);
          continue;
        }
        const rawText = parsed.text?.trim() ? parsed.text : htmlToPlainText(parsed.html || '');
        const text = stripQuotedReply(rawText);
        if (!text) {
          console.warn('[help-inquiry-mail] empty after quote strip', token);
          result.skipped += 1;
          await markHandled(client, uid, folder);
          continue;
        }
        const r = await applyInboundInquiryMail({ postId: post.id, kind, fromEmail, messageId, text });
        if (r.action === 'ADMIN_REPLY') result.answers += 1;
        else if (r.action === 'CUSTOMER_FOLLOWUP') result.followups += 1;
        else result.skipped += 1;
        await markHandled(client, uid, folder);
      }
    } finally {
      lock.release();
    }
    await client.logout();
    await setReplyInboxStatus(board.id, { lastSyncAt: new Date(), lastError: null });
  } catch (e) {
    const error = imapErrorText(e);
    await setReplyInboxStatus(board.id, { lastSyncAt: new Date(), lastError: error });
    try {
      await client.logout();
    } catch {
      /* 연결이 이미 끊김 */
    }
    throw new Error(error);
  }
  return result;
}

let running: Promise<PullResult> | null = null;

/** 답장 메일함이 연결된 문의 게시판 전부 — 동시에 두 번 돌지 않는다 */
export async function pullHelpInquiryMail(opts?: { boardSlug?: string }): Promise<PullResult> {
  if (running) return running;
  running = (async () => {
    const total: PullResult = { scanned: 0, answers: 0, followups: 0, skipped: 0, unknownSenders: 0 };
    const boards = await prisma.platformBoard.findMany({
      where: { boardType: 'INQUIRY', ...(opts?.boardSlug ? { slug: opts.boardSlug } : {}) },
      select: { id: true, slug: true, settings: true },
    });
    let lastError: Error | null = null;
    for (const board of boards) {
      const box = parseReplyInboxStored(board.settings);
      if (!box?.passEnc) continue;
      try {
        const r = await pullBoardInbox(board, box);
        total.scanned += r.scanned;
        total.answers += r.answers;
        total.followups += r.followups;
        total.skipped += r.skipped;
        total.unknownSenders += r.unknownSenders;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error('메일함 확인 실패');
        console.error('[help-inquiry-mail] pull failed', board.slug, lastError.message);
      }
    }
    if (lastError && opts?.boardSlug) throw lastError;
    return total;
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}

/** 서버 안에서 5분마다 — 메일함이 연결된 게시판이 있을 때만 접속한다 */
export function startHelpInquiryMailScheduler(): void {
  if (process.env.HELP_INQUIRY_MAIL_POLL_DISABLED === 'true') return;
  const intervalMs = 5 * 60 * 1000;
  const tick = () => {
    void pullHelpInquiryMail()
      .then((r) => {
        if (r.scanned > 0) console.info('[help-inquiry-mail] scheduled pull', r);
      })
      .catch((e) => console.error('[help-inquiry-mail] scheduled pull failed', e instanceof Error ? e.message : 'error'));
  };
  setTimeout(tick, 90_000).unref();
  setInterval(tick, intervalMs).unref();
}
