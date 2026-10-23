import { simpleParser } from 'mailparser';
import { ImapFlow } from 'imapflow';
import { prisma } from '../../lib/prisma.js';
import { decryptTenantSecret } from '../../lib/tenantSecretCrypto.js';
import { matchSkHomepageMail, relocateSkHomepageInquiriesToLeads } from './skHomepageMail.match.js';
import { formatSkHomepageQuote, parseSkHomepageQuote } from './skHomepageMail.parse.js';

const NAVER_IMAP_HOST = 'imap.naver.com';
const FIRST_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 40;
const MAX_BODY = 20_000;

function clip(value: string, max: number): string {
  const text = value.replace(/\u0000/g, '').trim();
  return text.length > max ? text.slice(0, max) : text;
}

function naverAuthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  if (/auth|login|invalid credentials|authentication/i.test(msg)) {
    return '네이버 로그인에 실패했습니다. IMAP 사용을 켜고, 2단계 인증이면 애플리케이션 비밀번호를 넣어 주세요.';
  }
  return '네이버 메일에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export async function testSkHomepageMailbox(mailbox: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = new ImapFlow({
    host: NAVER_IMAP_HOST,
    port: 993,
    secure: true,
    auth: { user: mailbox, pass: password },
    logger: false,
  });
  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: naverAuthError(e) };
  }
}

function mailRaw(text: string | undefined, html: unknown): string {
  const htmlText = typeof html === 'string' ? html : '';
  return `${text ?? ''}\n${htmlText}`;
}

export async function pullSkHomepageMail(tenantId: string): Promise<{ imported: number; scanned: number; created: number }> {
  const moved = await relocateSkHomepageInquiriesToLeads(tenantId);
  const inbox = await prisma.skHomepageMailInbox.findFirst({ where: { tenantId } });
  if (!inbox?.mailbox || !inbox.passwordEnc) {
    return { imported: 0, scanned: 0, created: moved };
  }
  const password = decryptTenantSecret(inbox.passwordEnc);
  if (!password) {
    await prisma.skHomepageMailInbox.update({
      where: { id: inbox.id },
      data: { lastError: '저장된 비밀번호를 읽지 못했습니다. 다시 저장해 주세요.', lastSyncAt: new Date() },
    });
    return { imported: 0, scanned: 0, created: moved };
  }

  const client = new ImapFlow({
    host: NAVER_IMAP_HOST,
    port: 993,
    secure: true,
    auth: { user: inbox.mailbox, pass: password },
    logger: false,
  });

  let imported = 0;
  let scanned = 0;
  let created = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = inbox.lastUid > 0
        ? await client.search({ uid: `${inbox.lastUid + 1}:*` }, { uid: true })
        : await client.search({ since: new Date(Date.now() - FIRST_LOOKBACK_MS) }, { uid: true });
      const list = (Array.isArray(uids) ? uids : []).slice(-MAX_PER_RUN);
      let maxUid = inbox.lastUid;
      for (const uid of list) {
        scanned += 1;
        if (uid > maxUid) maxUid = uid;
        const msg = await client.fetchOne(String(uid), { envelope: true, source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const messageId = clip(parsed.messageId || `uid:${uid}`, 255);
        const fromAddress = clip(parsed.from?.text || msg.envelope?.from?.[0]?.address || '', 320);
        const subject = clip(parsed.subject || msg.envelope?.subject || '', 500);
        const receivedAt = parsed.date ?? msg.envelope?.date ?? new Date();
        const raw = mailRaw(parsed.text, parsed.html);
        if (!subject.includes('간편견적')) continue;
        const quote = parseSkHomepageQuote(subject, raw);
        const textBody = clip(quote ? formatSkHomepageQuote(quote) : raw.replace(/<[^>]+>/g, ' '), MAX_BODY);
        const exists = await prisma.skHomepageInquiryMail.findFirst({
          where: { tenantId, messageId },
          select: { id: true },
        });
        if (exists) continue;
        const row = await prisma.skHomepageInquiryMail.create({
          data: {
            tenantId,
            inboxId: inbox.id,
            messageId,
            imapUid: uid,
            fromAddress,
            subject,
            receivedAt,
            textBody,
            status: 'PENDING_MATCH',
          },
          select: { id: true },
        });
        imported += 1;
        try {
          if (await matchSkHomepageMail(tenantId, row.id)) created += 1;
        } catch (e) {
          console.error('[sk-homepage-mail] match failed', row.id, e instanceof Error ? e.message : 'error');
        }
      }
      const pending = await prisma.skHomepageInquiryMail.findMany({
        where: { tenantId, status: 'PENDING_MATCH', landingContactId: null, inquiryId: null },
        select: { id: true },
        take: MAX_PER_RUN,
      });
      for (const row of pending) {
        try {
          if (await matchSkHomepageMail(tenantId, row.id)) created += 1;
        } catch (e) {
          console.error('[sk-homepage-mail] match failed', row.id, e instanceof Error ? e.message : 'error');
        }
      }
      await prisma.skHomepageMailInbox.update({
        where: { id: inbox.id },
        data: { lastUid: maxUid, lastSyncAt: new Date(), lastError: null },
      });
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (e) {
    const error = naverAuthError(e);
    await prisma.skHomepageMailInbox.update({
      where: { id: inbox.id },
      data: { lastError: error, lastSyncAt: new Date() },
    });
    throw new Error(error);
  }
  return { imported, scanned, created: created + moved };
}

export async function pullEnabledSkHomepageMailboxes(): Promise<{ tenants: number; imported: number; created: number }> {
  const rows = await prisma.skHomepageMailInbox.findMany({
    where: { enabled: true },
    select: { tenantId: true, tenant: { select: { slug: true } } },
  });
  let imported = 0;
  let created = 0;
  let tenants = 0;
  for (const row of rows) {
    const slug = row.tenant.slug?.trim().toLowerCase();
    if (slug !== 'sk' && slug !== 'skcleanteck') continue;
    tenants += 1;
    try {
      const result = await pullSkHomepageMail(row.tenantId);
      imported += result.imported;
      created += result.created;
    } catch (e) {
      console.error('[sk-homepage-mail] pull failed', row.tenantId, e instanceof Error ? e.message : 'error');
    }
  }
  return { tenants, imported, created };
}
