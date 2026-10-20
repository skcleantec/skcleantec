import { prisma } from '../../lib/prisma.js';
import { sendPlatformMail } from '../../lib/platformSmtp.service.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_NOTIFY_EMAILS = ['wsgpay@naver.com'];
const MAX_NOTIFY_EMAILS = 20;

export function parsePgNotifyEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().toLowerCase();
    if (!trimmed || !EMAIL_RE.test(trimmed) || out.includes(trimmed)) continue;
    out.push(trimmed);
    if (out.length >= MAX_NOTIFY_EMAILS) break;
  }
  return out;
}

async function settingsRow() {
  return prisma.platformCardPaymentSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', pgApplicationNotifyEmails: DEFAULT_NOTIFY_EMAILS },
    update: {},
  });
}

export async function getPgApplicationNotifyEmails(): Promise<string[]> {
  const row = await settingsRow();
  const parsed = parsePgNotifyEmails(row.pgApplicationNotifyEmails);
  return parsed.length > 0 ? parsed : [...DEFAULT_NOTIFY_EMAILS];
}

export async function savePgApplicationNotifyEmails(raw: unknown): Promise<string[]> {
  const emails = parsePgNotifyEmails(raw);
  if (emails.length === 0) {
    throw new Error('받는 메일을 한 곳 이상 적어 주세요.');
  }
  await prisma.platformCardPaymentSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', pgApplicationNotifyEmails: emails },
    update: { pgApplicationNotifyEmails: emails },
  });
  return emails;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function kindLabel(kind: string | null): string {
  if (kind === 'CORPORATE') return '법인사업자';
  if (kind === 'SOLE_PROPRIETOR') return '개인사업자';
  return kind?.trim() || '—';
}

export async function notifyPgApplicationSubmitted(input: {
  tenantId: string;
  businessName: string | null;
  businessKind: string | null;
  bizNumber: string | null;
  representativeName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  submittedAt: string | null;
}): Promise<{ sent: number; skipped?: string }> {
  const emails = await getPgApplicationNotifyEmails();
  if (emails.length === 0) return { sent: 0, skipped: 'NO_NOTIFY_EMAILS' };

  const tenant = await prisma.tenant.findFirst({
    where: { id: input.tenantId },
    select: { name: true, slug: true },
  });
  const company = input.businessName?.trim() || tenant?.name?.trim() || '업체';
  const when = input.submittedAt
    ? new Date(input.submittedAt).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
    : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
  const lines = [
    ['청소비서 업체', tenant?.name?.trim() || '—'],
    ['상호', company],
    ['사업자 구분', kindLabel(input.businessKind)],
    ['사업자번호', input.bizNumber?.trim() || '—'],
    ['대표자', input.representativeName?.trim() || '—'],
    ['담당자', input.contactName?.trim() || '—'],
    ['전화', input.contactPhone?.trim() || '—'],
    ['이메일', input.contactEmail?.trim() || '—'],
    ['접수 시각', when],
  ];
  const html = `
    <h2>청소비서 — PG 신청</h2>
    ${lines
      .map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`)
      .join('')}
    <p style="color:#64748b;font-size:12px;">원성 PG 관리의 PG 신청에서 확인하세요.</p>
  `.trim();
  const text = ['[청소비서 PG 신청]', ...lines.map(([label, value]) => `${label}: ${value}`)].join('\n');

  let sent = 0;
  for (const to of emails) {
    const result = await sendPlatformMail({
      to,
      subject: `[청소비서] PG 신청 — ${company}`,
      html,
      text,
    });
    if (result.sent) sent += 1;
    else console.error('[pg-application notify]', to, result.reason ?? 'SEND_FAILED', result.detail ?? '');
  }
  return { sent };
}
