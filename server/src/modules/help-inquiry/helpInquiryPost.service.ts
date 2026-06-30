import { prisma } from '../../lib/prisma.js';
import {
  categoryLabelFor,
  getHelpInquirySettings,
} from './helpInquirySettings.service.js';
import { notifyHelpInquiryPostByEmail } from './helpInquiry.email.service.js';
import type { HelpInquiryPostDto } from './helpInquiry.types.js';

function parseImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((u): u is string => typeof u === 'string' && u.trim().length > 0).slice(0, 12);
}

function rowToDto(
  row: {
    id: string;
    categoryId: string;
    authorName: string;
    authorEmail: string;
    title: string;
    bodyMarkdown: string;
    imageUrls: unknown;
    createdAt: Date;
  },
  categoryLabel: string,
): HelpInquiryPostDto {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryLabel,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    title: row.title,
    bodyMarkdown: row.bodyMarkdown,
    imageUrls: parseImageUrls(row.imageUrls),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listHelpInquiryPosts(params: {
  limit: number;
  offset: number;
}): Promise<{ items: HelpInquiryPostDto[]; total: number }> {
  const settings = await getHelpInquirySettings();
  const [rows, total] = await Promise.all([
    prisma.helpInquiryPost.findMany({
      orderBy: { createdAt: 'desc' },
      take: params.limit,
      skip: params.offset,
    }),
    prisma.helpInquiryPost.count(),
  ]);
  return {
    items: rows.map((r: (typeof rows)[number]) => rowToDto(r, categoryLabelFor(settings, r.categoryId))),
    total,
  };
}

export async function getHelpInquiryPost(id: string): Promise<HelpInquiryPostDto | null> {
  const settings = await getHelpInquirySettings();
  const row = await prisma.helpInquiryPost.findUnique({ where: { id } });
  if (!row) return null;
  return rowToDto(row, categoryLabelFor(settings, row.categoryId));
}

export async function createHelpInquiryPost(input: {
  categoryId: string;
  authorName: string;
  authorEmail: string;
  title: string;
  bodyMarkdown: string;
  imageUrls: string[];
}): Promise<{ post: HelpInquiryPostDto; emailSent: boolean; emailSkipReason?: string }> {
  const settings = await getHelpInquirySettings();
  const categoryId = input.categoryId.trim();
  if (!settings.categories.some((c) => c.id === categoryId)) {
    throw new Error('INVALID_CATEGORY');
  }
  const authorName = input.authorName.trim().slice(0, 64);
  const authorEmail = input.authorEmail.trim().slice(0, 256);
  const title = input.title.trim().slice(0, 200);
  const bodyMarkdown = input.bodyMarkdown.trim().slice(0, 50000);
  if (!authorName || !authorEmail.includes('@') || !title || !bodyMarkdown) {
    throw new Error('VALIDATION');
  }
  const imageUrls = input.imageUrls.filter(Boolean).slice(0, 12);

  const row = await prisma.helpInquiryPost.create({
    data: {
      categoryId,
      authorName,
      authorEmail,
      title,
      bodyMarkdown,
      imageUrls,
    },
  });

  const post = rowToDto(row, categoryLabelFor(settings, row.categoryId));
  let emailSent = false;
  let emailSkipReason: string | undefined;
  try {
    const mail = await notifyHelpInquiryPostByEmail(settings.notifyEmail, post);
    emailSent = mail.sent;
    emailSkipReason = mail.reason;
  } catch (e) {
    console.error('[help-inquiry] email notify failed', e);
    emailSkipReason = 'SEND_FAILED';
  }

  return { post, emailSent, emailSkipReason };
}
