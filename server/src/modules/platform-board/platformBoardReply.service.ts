/**
 * 1:1 문의 답변 — 플랫폼에서 쓴 답변, 메일로 온 담당자 답변·고객 추가 질문.
 */
import { prisma } from '../../lib/prisma.js';
import { getPlatformBoardPost, toReplyDto, type PlatformBoardReplyDto } from './platformBoard.service.js';
import { parseBoardSettings, parseReplyInboxStored, sanitizeBoardBodyHtml } from './platformBoard.helpers.js';
import { notifyInquiryStaff, sendInquiryAnswerToCustomer } from './platformBoard.email.service.js';
import { MAX_NOTIFY_EMAILS, htmlToPlainText, plainTextToSafeHtml } from './platformBoardInquiry.helpers.js';
import { withOperationNotifyEmails } from '../../lib/operationNotifyEmails.js';

type BoardMailContext = { notifyEmails: string[]; replyInboxEmail: string | null };

/**
 * 문의 알림 받는 사람 = 운영 알림 메일(입금 확인 요청 받는 메일) + 게시판에 따로 넣은 메일.
 * 답장 메일의 발신자가 이 안에 있으면 담당자 답변으로 본다.
 */
export async function resolveInquiryStaffEmails(boardSettings: unknown): Promise<string[]> {
  return withOperationNotifyEmails(parseBoardSettings(boardSettings).notifyEmails, MAX_NOTIFY_EMAILS);
}

async function boardMailContext(boardId: string): Promise<BoardMailContext> {
  const board = await prisma.platformBoard.findUnique({ where: { id: boardId }, select: { settings: true } });
  const inbox = parseReplyInboxStored(board?.settings);
  return {
    notifyEmails: await resolveInquiryStaffEmails(board?.settings),
    replyInboxEmail: inbox?.passEnc ? inbox.email : null,
  };
}

/** 새 문의 알림 — 등록 직후 */
export async function notifyNewInquiry(postId: string): Promise<{ sent: number; failed: number }> {
  const post = await getPlatformBoardPost(postId);
  if (!post) return { sent: 0, failed: 0 };
  const ctx = await boardMailContext(post.boardId);
  return notifyInquiryStaff({
    post,
    notifyEmails: ctx.notifyEmails,
    replyInboxEmail: ctx.replyInboxEmail,
    kind: 'NEW',
  });
}

async function deliverAnswer(replyId: string): Promise<PlatformBoardReplyDto> {
  const reply = await prisma.platformBoardReply.findUnique({ where: { id: replyId } });
  if (!reply) throw new Error('NOT_FOUND');
  const post = await getPlatformBoardPost(reply.postId);
  if (!post) throw new Error('NOT_FOUND');
  const ctx = await boardMailContext(post.boardId);
  const mail = await sendInquiryAnswerToCustomer({
    post,
    answerHtml: reply.bodyHtml,
    replyInboxEmail: ctx.replyInboxEmail,
  });
  const updated = await prisma.platformBoardReply.update({
    where: { id: reply.id },
    data: mail.sent
      ? { emailSentAt: new Date(), emailError: null }
      : { emailError: (mail.error ?? '메일을 보내지 못했어요.').slice(0, 500) },
  });
  if (!mail.sent) console.warn('[help-inquiry-mail] answer not sent', reply.id);
  return toReplyDto(updated, { includeContact: true });
}

/** 플랫폼 화면에서 쓴 답변 → 저장 · 답변완료 · 고객 메일 */
export async function createPlatformInquiryReply(input: {
  postId: string;
  bodyHtml: string;
  platformUserId: string | null;
}): Promise<PlatformBoardReplyDto> {
  const post = await prisma.platformBoardPost.findUnique({
    where: { id: input.postId },
    select: { id: true, board: { select: { boardType: true } } },
  });
  if (!post) throw new Error('NOT_FOUND');
  if (post.board.boardType !== 'INQUIRY') throw new Error('VALIDATION');
  const bodyHtml = sanitizeBoardBodyHtml(input.bodyHtml);
  const bodyText = htmlToPlainText(bodyHtml);
  if (!bodyText && !/<img\b/i.test(bodyHtml)) throw new Error('CONTENT_REQUIRED');

  const reply = await prisma.$transaction(async (tx) => {
    const created = await tx.platformBoardReply.create({
      data: {
        postId: post.id,
        authorType: 'ADMIN',
        source: 'PLATFORM',
        bodyHtml,
        bodyText,
        platformUserId: input.platformUserId,
      },
    });
    await tx.platformBoardPost.update({ where: { id: post.id }, data: { status: 'ANSWERED' } });
    return created;
  });
  return deliverAnswer(reply.id);
}

/** 「다시 보내기」 */
export async function resendPlatformInquiryReply(postId: string, replyId: string): Promise<PlatformBoardReplyDto> {
  const reply = await prisma.platformBoardReply.findFirst({
    where: { id: replyId, postId, authorType: 'ADMIN' },
    select: { id: true },
  });
  if (!reply) throw new Error('NOT_FOUND');
  return deliverAnswer(reply.id);
}

export type InboundMailResult =
  | { action: 'ADMIN_REPLY' | 'CUSTOMER_FOLLOWUP'; postId: string }
  | { action: 'SKIPPED'; reason: 'DUPLICATE' | 'EMPTY' | 'UNKNOWN_SENDER' | 'NO_POST' };

/**
 * 메일함에서 읽은 답장 한 통을 처리한다.
 * kind 는 classifyInquirySender 결과(담당자·작성자·모르는 사람).
 */
export async function applyInboundInquiryMail(input: {
  postId: string;
  kind: 'ADMIN' | 'CUSTOMER';
  fromEmail: string;
  messageId: string;
  text: string;
}): Promise<InboundMailResult> {
  const exists = await prisma.platformBoardReply.findUnique({
    where: { messageId: input.messageId },
    select: { id: true },
  });
  if (exists) return { action: 'SKIPPED', reason: 'DUPLICATE' };
  const text = input.text.trim().slice(0, 20_000);
  if (!text) return { action: 'SKIPPED', reason: 'EMPTY' };
  const bodyHtml = plainTextToSafeHtml(text);

  if (input.kind === 'ADMIN') {
    const reply = await prisma.$transaction(async (tx) => {
      const created = await tx.platformBoardReply.create({
        data: {
          postId: input.postId,
          authorType: 'ADMIN',
          source: 'EMAIL',
          bodyHtml,
          bodyText: text,
          fromEmail: input.fromEmail.slice(0, 320),
          messageId: input.messageId.slice(0, 512),
        },
      });
      await tx.platformBoardPost.update({ where: { id: input.postId }, data: { status: 'ANSWERED' } });
      return created;
    });
    await deliverAnswer(reply.id);
    return { action: 'ADMIN_REPLY', postId: input.postId };
  }

  await prisma.$transaction(async (tx) => {
    await tx.platformBoardReply.create({
      data: {
        postId: input.postId,
        authorType: 'CUSTOMER',
        source: 'EMAIL',
        bodyHtml,
        bodyText: text,
        fromEmail: input.fromEmail.slice(0, 320),
        messageId: input.messageId.slice(0, 512),
      },
    });
    await tx.platformBoardPost.update({ where: { id: input.postId }, data: { status: 'OPEN' } });
  });
  const post = await getPlatformBoardPost(input.postId);
  if (post) {
    const ctx = await boardMailContext(post.boardId);
    await notifyInquiryStaff({
      post,
      notifyEmails: ctx.notifyEmails,
      replyInboxEmail: ctx.replyInboxEmail,
      kind: 'FOLLOWUP',
      followupText: text,
    });
  }
  return { action: 'CUSTOMER_FOLLOWUP', postId: input.postId };
}
