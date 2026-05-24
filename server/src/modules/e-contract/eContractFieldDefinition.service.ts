import {
  EContractAudience,
  EContractFieldFilledBy,
  EContractFieldInputType,
  type EContractFieldDefinition,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  EC_SIGNATURE_TOKEN,
  EC_CONTRACT_DATE_TOKEN,
  extractEcTokensFromText,
  formatKstContractDate,
  isValidEcToken,
  mergeFieldsFromJson,
  suggestEcTokenFromLabel,
} from './eContractField.tokens.js';

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
  audience: EContractAudience,
  opts?: { activeOnly?: boolean }
): Promise<EContractFieldDefinitionDto[]> {
  const rows = await prisma.eContractFieldDefinition.findMany({
    where: {
      audience,
      ...(opts?.activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });
  const usage = await Promise.all(rows.map((r) => tokenInUse(r.token)));
  return rows.map((r, i) => mapRow(r, usage[i] ?? false));
}

export async function createFieldDefinition(input: {
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
    where: { audience: input.audience },
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
    where: { audience: input.audience },
    _max: { sortOrder: true },
  });
  const sortOrder =
    typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder)
      ? Math.round(input.sortOrder)
      : (maxSort._max.sortOrder ?? 0) + 10;

  const row = await prisma.eContractFieldDefinition.create({
    data: {
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
  const existing = await prisma.eContractFieldDefinition.findUnique({ where: { id } });
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

export async function deleteFieldDefinition(id: string): Promise<void> {
  const existing = await prisma.eContractFieldDefinition.findUnique({ where: { id } });
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

export async function buildExpansionValueMap(input: {
  audience: EContractAudience;
  bodyText: string;
  mergeFields?: unknown;
  signerValues?: Record<string, string>;
  signedAt?: Date;
  signatureUrl?: string | null;
  /** true면 AUTO·미입력 SIGNER 는 치환 전 빈값(미리보기용) */
  previewMode?: boolean;
}): Promise<Record<string, string>> {
  const fields = await resolveFieldsForBody(input.bodyText, input.audience);
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
  return out;
}

export async function validateAdminMergeFields(input: {
  audience: EContractAudience;
  bodyText: string;
  mergeFields: unknown;
}): Promise<Record<string, string>> {
  const fields = await resolveFieldsForBody(input.bodyText, input.audience, {
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
