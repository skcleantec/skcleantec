import {
  EContractAudience,
  EContractFieldFilledBy,
  EContractFieldInputType,
  type EContractFieldDefinition,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  EC_CHALLENGE_DIGITS_TOKEN,
  EC_SIGNATURE_TOKEN,
  EC_CONTRACT_DATE_TOKEN,
  extractEcTokensFromText,
  formatKstContractDate,
  isValidEcToken,
  mergeFieldsFromJson,
  suggestEcTokenFromLabel,
} from './eContractField.tokens.js';
import { DEFAULT_FIELD_SPECS_BY_AUDIENCE } from './eContractDefaultFieldDefinitions.js';

export type EContractFieldDefinitionDto = {
  id: string;
  audience: EContractAudience;
  token: string;
  label: string;
  inputType: EContractFieldInputType;
  filledBy: EContractFieldFilledBy;
  required: boolean;
  sortOrder: number;
  isActive: boolean;
  inUse: boolean;
};

function mapRow(row: EContractFieldDefinition, inUse: boolean): EContractFieldDefinitionDto {
  return {
    id: row.id,
    audience: row.audience,
    token: row.token,
    label: row.label,
    inputType: row.inputType,
    filledBy: row.filledBy,
    required: row.required,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    inUse,
  };
}

async function tokenInUse(token: string): Promise<boolean> {
  const rows = await prisma.eContractVersion.findMany({
    where: {
      OR: [{ bodyMarkdown: { contains: token } }, { bodyDisplayHtml: { contains: token } }],
    },
    select: { id: true },
    take: 1,
  });
  return rows.length > 0;
}

export async function listFieldDefinitions(
  tenantId: string,
  audience: EContractAudience,
  opts?: { activeOnly?: boolean }
): Promise<EContractFieldDefinitionDto[]> {
  await ensureDefaultFieldDefinitions(tenantId, audience);
  const rows = await prisma.eContractFieldDefinition.findMany({
    where: {
      tenantId,
      audience,
      ...(opts?.activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });
  const usage = await Promise.all(rows.map((r) => tokenInUse(r.token)));
  return rows.map((r, i) => mapRow(r, usage[i] ?? false));
}

/** TEAM_MEMBER 등 신규 audience — 기본 체결 필드가 없으면 팀장과 동일 을-party 항목을 보강 */
export async function ensureDefaultFieldDefinitions(
  tenantId: string,
  audience: EContractAudience,
): Promise<void> {
  const defaults = DEFAULT_FIELD_SPECS_BY_AUDIENCE[audience];
  if (!defaults?.length) return;

  const existing = await prisma.eContractFieldDefinition.findMany({
    where: { tenantId, audience },
    select: { token: true },
  });
  const have = new Set(existing.map((r) => r.token));
  const missing = defaults.filter((d) => !have.has(d.token));
  if (missing.length === 0) return;

  await prisma.eContractFieldDefinition.createMany({
    data: missing.map((d) => ({
      tenantId,
      audience,
      token: d.token,
      label: d.label,
      inputType: d.inputType,
      filledBy: d.filledBy,
      required: d.required,
      sortOrder: d.sortOrder,
      isActive: true,
    })),
    skipDuplicates: true,
  });
}

export async function createFieldDefinition(
  tenantId: string,
  input: {
  audience: EContractAudience;
  label: string;
  token?: string | null;
  inputType?: EContractFieldInputType;
  filledBy: EContractFieldFilledBy;
  required?: boolean;
  sortOrder?: number;
}): Promise<EContractFieldDefinitionDto> {
  const label = input.label.trim();
  if (!label || label.length > 128) {
    throw Object.assign(new Error('label_invalid'), { code: 'bad_request' as const });
  }

  const existingTokens = await prisma.eContractFieldDefinition.findMany({
    where: { tenantId, audience: input.audience },
    select: { token: true },
  });
  const set = new Set(existingTokens.map((r) => r.token));
  let token = input.token?.trim() ?? '';
  if (!token) {
    token = input.filledBy === EContractFieldFilledBy.AUTO ? EC_CONTRACT_DATE_TOKEN : suggestEcTokenFromLabel(label, set);
  }
  if (!isValidEcToken(token)) {
    throw Object.assign(new Error('token_invalid'), { code: 'bad_request' as const });
  }
  if (set.has(token)) {
    throw Object.assign(new Error('token_duplicate'), { code: 'conflict' as const });
  }
  if (token === EC_SIGNATURE_TOKEN && input.filledBy !== EContractFieldFilledBy.SIGNER) {
    throw Object.assign(new Error('signature_signer_only'), { code: 'bad_request' as const });
  }

  const maxSort = await prisma.eContractFieldDefinition.aggregate({
    where: { tenantId, audience: input.audience },
    _max: { sortOrder: true },
  });
  const sortOrder =
    typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder)
      ? Math.round(input.sortOrder)
      : (maxSort._max.sortOrder ?? 0) + 10;

  const row = await prisma.eContractFieldDefinition.create({
    data: {
      tenantId,
      audience: input.audience,
      token,
      label,
      inputType: input.inputType ?? EContractFieldInputType.TEXT,
      filledBy: input.filledBy,
      required: input.required ?? true,
      sortOrder,
      isActive: true,
    },
  });
  return mapRow(row, false);
}

export async function patchFieldDefinition(
  tenantId: string,
  id: string,
  patch: {
    label?: string;
    inputType?: EContractFieldInputType;
    filledBy?: EContractFieldFilledBy;
    required?: boolean;
    sortOrder?: number;
    isActive?: boolean;
  }
): Promise<EContractFieldDefinitionDto> {
  const existing = await prisma.eContractFieldDefinition.findFirst({ where: { id, tenantId } });
  if (!existing) throw Object.assign(new Error('not_found'), { code: 'not_found' as const });

  const data: Prisma.EContractFieldDefinitionUpdateInput = {};
  if (patch.label !== undefined) {
    const t = patch.label.trim();
    if (!t || t.length > 128) throw Object.assign(new Error('label_invalid'), { code: 'bad_request' as const });
    data.label = t;
  }
  if (patch.inputType !== undefined) data.inputType = patch.inputType;
  if (patch.filledBy !== undefined) {
    if (existing.token === EC_SIGNATURE_TOKEN && patch.filledBy !== EContractFieldFilledBy.SIGNER) {
      throw Object.assign(new Error('signature_signer_only'), { code: 'bad_request' as const });
    }
    if (existing.token === EC_CONTRACT_DATE_TOKEN && patch.filledBy !== EContractFieldFilledBy.AUTO) {
      throw Object.assign(new Error('contract_date_auto_only'), { code: 'bad_request' as const });
    }
    data.filledBy = patch.filledBy;
  }
  if (patch.required !== undefined) data.required = patch.required;
  if (patch.sortOrder !== undefined) data.sortOrder = Math.round(patch.sortOrder);
  if (patch.isActive !== undefined) data.isActive = patch.isActive;

  if (Object.keys(data).length === 0) {
    throw Object.assign(new Error('nothing_to_patch'), { code: 'bad_request' as const });
  }

  const row = await prisma.eContractFieldDefinition.update({ where: { id }, data });
  const inUse = await tokenInUse(row.token);
  return mapRow(row, inUse);
}

export async function deleteFieldDefinition(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.eContractFieldDefinition.findFirst({ where: { id, tenantId } });
  if (!existing) throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  if (existing.token === EC_SIGNATURE_TOKEN || existing.token === EC_CONTRACT_DATE_TOKEN) {
    throw Object.assign(new Error('system_field'), { code: 'conflict' as const });
  }
  if (await tokenInUse(existing.token)) {
    throw Object.assign(new Error('token_in_use'), { code: 'conflict' as const });
  }
  await prisma.eContractFieldDefinition.delete({ where: { id } });
}

export type ResolvedFieldForBody = {
  id: string;
  token: string;
  label: string;
  inputType: EContractFieldInputType;
  filledBy: EContractFieldFilledBy;
  required: boolean;
  sortOrder: number;
};

export async function resolveFieldsForBody(
  tenantId: string,
  bodyText: string,
  audience: EContractAudience,
  opts?: { filledBy?: EContractFieldFilledBy | EContractFieldFilledBy[] }
): Promise<ResolvedFieldForBody[]> {
  const tokens = extractEcTokensFromText(bodyText);
  if (tokens.length === 0) return [];

  const filledFilter = opts?.filledBy
    ? Array.isArray(opts.filledBy)
      ? opts.filledBy
      : [opts.filledBy]
    : null;

  const rows = await prisma.eContractFieldDefinition.findMany({
    where: {
      tenantId,
      audience,
      isActive: true,
      token: { in: tokens },
      ...(filledFilter ? { filledBy: { in: filledFilter } } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    token: r.token,
    label: r.label,
    inputType: r.inputType,
    filledBy: r.filledBy,
    required: r.required,
    sortOrder: r.sortOrder,
  }));
}

/** 체결 페이지 입력 폼 — 설정된 모든 SIGNER 필드(서명 제외). 본문 토큰 유무와 무관 */
export async function resolveSignerFormFields(
  tenantId: string,
  audience: EContractAudience,
): Promise<ResolvedFieldForBody[]> {
  await ensureDefaultFieldDefinitions(tenantId, audience);
  const rows = await prisma.eContractFieldDefinition.findMany({
    where: {
      tenantId,
      audience,
      isActive: true,
      filledBy: EContractFieldFilledBy.SIGNER,
      token: { not: EC_SIGNATURE_TOKEN },
    },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    token: r.token,
    label: r.label,
    inputType: r.inputType,
    filledBy: r.filledBy,
    required: r.required,
    sortOrder: r.sortOrder,
  }));
}

export async function buildExpansionValueMap(input: {
  tenantId: string;
  audience: EContractAudience;
  bodyText: string;
  mergeFields?: unknown;
  signerValues?: Record<string, string>;
  signedAt?: Date;
  signatureUrl?: string | null;
  /** 셀카 본인확인 6자리 — `[[EC_CHALLENGE_DIGITS]]` 치환 */
  challengeDigits?: string | null;
  /** true면 AUTO·미입력 SIGNER 는 치환 전 빈값(미리보기용) */
  previewMode?: boolean;
}): Promise<Record<string, string>> {
  const fields = await resolveFieldsForBody(input.tenantId, input.bodyText, input.audience);
  const merge = mergeFieldsFromJson(input.mergeFields);
  const signer = input.signerValues ?? {};
  const signedAt = input.signedAt ?? new Date();
  const out: Record<string, string> = {};

  for (const f of fields) {
    if (f.filledBy === EContractFieldFilledBy.ADMIN) {
      out[f.token] = merge[f.token] ?? '';
    } else if (f.filledBy === EContractFieldFilledBy.AUTO) {
      if (input.previewMode) {
        out[f.token] = '';
      } else if (f.token === EC_CONTRACT_DATE_TOKEN) {
        out[f.token] = formatKstContractDate(signedAt);
      }
    } else if (f.filledBy === EContractFieldFilledBy.SIGNER) {
      if (f.token === EC_SIGNATURE_TOKEN) {
        out[f.token] = (input.signatureUrl ?? signer[f.token] ?? '').trim();
      } else {
        out[f.token] = signer[f.token] ?? '';
      }
    }
  }

  if (extractEcTokensFromText(input.bodyText).includes(EC_CHALLENGE_DIGITS_TOKEN)) {
    if (input.previewMode) {
      out[EC_CHALLENGE_DIGITS_TOKEN] = '(체결 시 자동 기록)';
    } else {
      out[EC_CHALLENGE_DIGITS_TOKEN] = (input.challengeDigits ?? '').trim();
    }
  }

  return out;
}

export async function validateAdminMergeFields(input: {
  tenantId: string;
  audience: EContractAudience;
  bodyText: string;
  mergeFields: unknown;
}): Promise<Record<string, string>> {
  const fields = await resolveFieldsForBody(input.tenantId, input.bodyText, input.audience, {
    filledBy: EContractFieldFilledBy.ADMIN,
  });
  const raw = mergeFieldsFromJson(input.mergeFields);
  const out: Record<string, string> = {};
  for (const f of fields) {
    const val = (raw[f.token] ?? '').trim();
    if (f.required && !val) {
      throw Object.assign(new Error(`admin_field:${f.token}`), { code: 'bad_request' as const });
    }
    if (val) out[f.token] = val;
  }
  return out;
}
