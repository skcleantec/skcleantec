import { prisma } from '../../lib/prisma.js';
import {
  DEFAULT_HELP_INQUIRY_CATEGORIES,
  type HelpInquiryCategory,
  type HelpInquirySettingsDto,
} from './helpInquiry.types.js';

function parseCategories(raw: unknown): HelpInquiryCategory[] {
  if (!Array.isArray(raw)) return DEFAULT_HELP_INQUIRY_CATEGORIES;
  const out: HelpInquiryCategory[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim() : '';
    const label = typeof o.label === 'string' ? o.label.trim() : '';
    if (!id || !label) continue;
    const sortOrder = typeof o.sortOrder === 'number' && Number.isFinite(o.sortOrder) ? o.sortOrder : out.length;
    out.push({ id, label, sortOrder });
  }
  out.sort((a, b) => a.sortOrder - b.sortOrder);
  return out.length > 0 ? out : DEFAULT_HELP_INQUIRY_CATEGORIES;
}

function rowToDto(row: {
  contactEmail: string;
  notifyEmail: string;
  composeHelpText: string | null;
  categoriesJson: unknown;
}): HelpInquirySettingsDto {
  return {
    contactEmail: row.contactEmail.trim(),
    notifyEmail: row.notifyEmail.trim(),
    composeHelpText: row.composeHelpText?.trim() || null,
    categories: parseCategories(row.categoriesJson),
  };
}

export async function getHelpInquirySettings(): Promise<HelpInquirySettingsDto> {
  let row = await prisma.helpInquirySettings.findUnique({ where: { id: 'default' } });
  if (!row) {
    row = await prisma.helpInquirySettings.create({
      data: {
        id: 'default',
        contactEmail: 'pyo0829@gmail.com',
        notifyEmail: 'pyo0829@gmail.com',
        categoriesJson: DEFAULT_HELP_INQUIRY_CATEGORIES,
      },
    });
  }
  return rowToDto(row);
}

export function categoryLabelFor(settings: HelpInquirySettingsDto, categoryId: string): string {
  const hit = settings.categories.find((c) => c.id === categoryId);
  return hit?.label ?? categoryId;
}

export async function updateHelpInquirySettings(input: {
  contactEmail?: string;
  notifyEmail?: string;
  composeHelpText?: string | null;
  categories?: HelpInquiryCategory[];
}): Promise<HelpInquirySettingsDto> {
  await getHelpInquirySettings();
  const data: {
    contactEmail?: string;
    notifyEmail?: string;
    composeHelpText?: string | null;
    categoriesJson?: HelpInquiryCategory[];
  } = {};

  if (input.contactEmail !== undefined) {
    const email = input.contactEmail.trim();
    if (!email.includes('@')) throw new Error('INVALID_CONTACT_EMAIL');
    data.contactEmail = email.slice(0, 256);
  }
  if (input.notifyEmail !== undefined) {
    const email = input.notifyEmail.trim();
    if (!email.includes('@')) throw new Error('INVALID_NOTIFY_EMAIL');
    data.notifyEmail = email.slice(0, 256);
  }
  if (input.composeHelpText !== undefined) {
    const t = input.composeHelpText?.trim() ?? '';
    data.composeHelpText = t ? t.slice(0, 8000) : null;
  }
  if (input.categories !== undefined) {
    const cats = input.categories
      .map((c, i) => ({
        id: c.id.trim().slice(0, 64),
        label: c.label.trim().slice(0, 64),
        sortOrder: Number.isFinite(c.sortOrder) ? c.sortOrder : i,
      }))
      .filter((c) => c.id && c.label);
    if (cats.length === 0) throw new Error('CATEGORIES_REQUIRED');
    data.categoriesJson = cats.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const row = await prisma.helpInquirySettings.update({
    where: { id: 'default' },
    data,
  });
  return rowToDto(row);
}
