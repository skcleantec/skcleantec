import { prisma } from '../../lib/prisma.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseNotifyEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().toLowerCase();
    if (!trimmed || !EMAIL_RE.test(trimmed)) continue;
    if (!out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

export async function getPlatformSignupInquirySettings() {
  const row = await prisma.platformSignupInquirySettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', notifyEmails: [] },
    update: {},
  });
  return {
    notifyEmails: parseNotifyEmails(row.notifyEmails),
    replyToEmail: row.replyToEmail?.trim() || null,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updatePlatformSignupInquirySettings(input: {
  notifyEmails?: string[];
  replyToEmail?: string | null;
  isActive?: boolean;
}) {
  const notifyEmails =
    input.notifyEmails !== undefined ? parseNotifyEmails(input.notifyEmails) : undefined;
  if (input.notifyEmails !== undefined && notifyEmails!.length === 0) {
    throw new Error('NOTIFY_EMAILS_REQUIRED');
  }

  let replyToEmail: string | null | undefined;
  if (input.replyToEmail !== undefined) {
    if (input.replyToEmail === null || input.replyToEmail.trim() === '') {
      replyToEmail = null;
    } else {
      const trimmed = input.replyToEmail.trim();
      if (!EMAIL_RE.test(trimmed)) throw new Error('INVALID_REPLY_TO_EMAIL');
      replyToEmail = trimmed;
    }
  }

  const row = await prisma.platformSignupInquirySettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      notifyEmails: notifyEmails ?? [],
      replyToEmail: replyToEmail ?? null,
      isActive: input.isActive ?? true,
    },
    update: {
      ...(notifyEmails !== undefined ? { notifyEmails } : {}),
      ...(replyToEmail !== undefined ? { replyToEmail } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  return {
    notifyEmails: parseNotifyEmails(row.notifyEmails),
    replyToEmail: row.replyToEmail?.trim() || null,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}
