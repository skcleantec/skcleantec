import type { Prisma, PrismaClient } from '@prisma/client';

/** @sync shared/inquiryLeadSourceDefaults.ts DEFAULT_INQUIRY_LEAD_SOURCE_LABELS */
export const DEFAULT_INQUIRY_LEAD_SOURCE_LABELS = [
  '숨고',
  '미소',
  '당근',
  '네이버',
  '크린토피아',
] as const;

/** @sync shared/inquiryIntakeChannel.ts INQUIRY_INTAKE_CHANNEL_LABELS */
export const INQUIRY_INTAKE_CHANNEL_LABELS = {
  telecrm: '텔레CRM',
  order_issue: '발주서 발급',
  order_form_submit: '고객 발주서 제출',
  schedule: '스케줄 접수',
  phone: '전화 접수',
  manual: '수기등록',
} as const;

export type InquiryIntakeChannelId = keyof typeof INQUIRY_INTAKE_CHANNEL_LABELS;

const INQUIRY_INTAKE_CHANNEL_IDS = new Set<string>(Object.keys(INQUIRY_INTAKE_CHANNEL_LABELS));

type Db = PrismaClient | Prisma.TransactionClient;

export function serializeInquiryLeadSourceOption(row: {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    label: row.label,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 테넌트에 기본 유입경로 5종이 없으면 추가(멱등) */
export async function seedInquiryLeadSourceDefaultsForTenant(db: Db, tenantId: string): Promise<void> {
  for (let i = 0; i < DEFAULT_INQUIRY_LEAD_SOURCE_LABELS.length; i++) {
    const label = DEFAULT_INQUIRY_LEAD_SOURCE_LABELS[i];
    const exists = await db.inquiryLeadSourceOption.findFirst({
      where: { tenantId, label },
      select: { id: true },
    });
    if (exists) continue;
    await db.inquiryLeadSourceOption.create({
      data: { tenantId, label, sortOrder: i, isActive: true },
    });
  }
}

export async function ensureInquiryLeadSourceDefaultsForAllTenants(db: PrismaClient): Promise<void> {
  const tenants = await db.tenant.findMany({ select: { id: true } });
  for (const t of tenants) {
    await seedInquiryLeadSourceDefaultsForTenant(db, t.id);
  }
}

export async function listActiveInquiryLeadSources(db: Db, tenantId: string) {
  return db.inquiryLeadSourceOption.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function assertActiveLeadSourceLabel(
  db: Db,
  tenantId: string,
  label: unknown,
): Promise<string> {
  const trimmed = typeof label === 'string' ? label.trim() : '';
  if (!trimmed) {
    throw new LeadSourceValidationError('유입 경로를 선택해 주세요.');
  }
  const row = await db.inquiryLeadSourceOption.findFirst({
    where: { tenantId, label: trimmed, isActive: true },
    select: { id: true },
  });
  if (!row) {
    throw new LeadSourceValidationError(
      '선택한 유입 경로가 없거나 비활성입니다. 발주서 설정 → 유입경로에서 확인해 주세요.',
    );
  }
  return trimmed;
}

export class LeadSourceValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'LeadSourceValidationError';
  }
}

export function parseIntakeMeta(raw: unknown): {
  channel?: InquiryIntakeChannelId;
  extractPlatform?: 'miso' | 'soomgo';
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const channelRaw = typeof o.channel === 'string' ? o.channel.trim() : '';
  const channel = INQUIRY_INTAKE_CHANNEL_IDS.has(channelRaw)
    ? (channelRaw as InquiryIntakeChannelId)
    : undefined;
  const epRaw = typeof o.extractPlatform === 'string' ? o.extractPlatform.trim() : '';
  const extractPlatform =
    epRaw === 'miso' || epRaw === 'soomgo' ? epRaw : undefined;
  if (!channel && !extractPlatform) return null;
  return { channel, extractPlatform };
}

export function resolveInquiryIntakeChannelForCreate(
  body: Record<string, unknown>,
): InquiryIntakeChannelId | null {
  const meta = parseIntakeMeta(body.intakeMeta);
  if (meta?.channel) return meta.channel;
  if (!isStrictLeadSourceBody(body)) {
    const s = body.source != null ? String(body.source).trim() : '';
    if (s === '전화') return 'phone';
    if (s.includes('수기등록') || s.includes('외부업체')) return 'manual';
  }
  return null;
}

function isStrictLeadSourceBody(body: Record<string, unknown>): boolean {
  if (body.strictLeadSource === true || body.strictLeadSource === 'true') return true;
  const meta = parseIntakeMeta(body.intakeMeta);
  return (
    meta?.channel === 'telecrm' ||
    meta?.channel === 'order_issue' ||
    meta?.channel === 'schedule'
  );
}

/** 접수 생성 시 source — strict면 카탈로그 검증, 아니면 legacy(기본 전화) */
export async function resolveInquirySourceForCreate(
  db: Db,
  tenantId: string,
  body: Record<string, unknown>,
): Promise<string> {
  if (isStrictLeadSourceBody(body)) {
    return assertActiveLeadSourceLabel(db, tenantId, body.source);
  }
  const s = body.source != null ? String(body.source).trim() : '';
  return s || '전화';
}

export function buildIntakeCreateChangeLogLines(
  source: string | null | undefined,
  intakeMeta: ReturnType<typeof parseIntakeMeta>,
): string[] {
  if (intakeMeta?.channel === 'telecrm') {
    const lines = ['텔레CRM 접수 저장', `유입경로: ${(source ?? '').trim() || '(없음)'}`];
    if (intakeMeta.extractPlatform === 'miso') lines.push('정보 갖고오기: 미소');
    if (intakeMeta.extractPlatform === 'soomgo') lines.push('정보 갖고오기: 숨고');
    return lines;
  }
  if (intakeMeta?.channel === 'order_issue') {
    return ['발주서 발급', `유입경로: ${(source ?? '').trim() || '(없음)'}`];
  }
  return [];
}

export function mapLeadSourceValidationError(e: unknown): { status: number; message: string } | null {
  if (e instanceof LeadSourceValidationError) {
    return { status: e.status, message: e.message };
  }
  return null;
}
