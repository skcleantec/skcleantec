import { prisma } from '../../lib/prisma.js';
import {
  defaultCustomerPages,
  looksLikeMachineChoiceCode,
  resolveCustomerPages,
} from '../../lib/orderFormCustomerPages.js';
import type {
  TelecrmPropertyChoiceOption,
  TelecrmPropertyChoiceOptions,
} from '../../lib/telecrmQuoteCrewLearning.js';

/**
 * 건축물 유형(propertyType)·건물 형태(buildingType) 선택지 — 손님 발주서와 같은 순서로 찾는다.
 * 1) 발주서 손님 페이지(「어떤 공간인가요?」「건물 형태는요?」)를 고친 경우 그 선택지
 * 2) 양식 표준 칸에 적어 둔 선택지
 * 3) 코드 기본값
 * 기본 발주서를 먼저 보고, 다른 양식(보관 포함)의 선택지는 이름 찾기용으로만 더한다.
 */

type ChoiceKind = 'property' | 'building';

const SYSTEM_FIELD: Record<ChoiceKind, string> = { property: 'propertyType', building: 'buildingType' };

function defaultChoices(kind: ChoiceKind): TelecrmPropertyChoiceOption[] {
  const page = defaultCustomerPages().find((p) => p.id === kind);
  return (page?.choices ?? []).map((c) => ({ value: c.value, label: c.label }));
}

type TemplateRow = {
  customerWizardJson: unknown;
  fields: { systemField: string | null; options: unknown }[];
};

function choicesForTemplate(t: TemplateRow, kind: ChoiceKind): TelecrmPropertyChoiceOption[] {
  if (t.customerWizardJson != null) {
    const page = resolveCustomerPages(t.customerWizardJson).find((p) => p.id === kind);
    const saved = (page?.choices ?? [])
      .map((c) => ({ value: c.value.trim(), label: c.label.trim() }))
      .filter((c) => c.value && c.label);
    if (saved.length > 0) return saved;
  }
  const field = t.fields.find((f) => f.systemField === SYSTEM_FIELD[kind]);
  const custom = Array.isArray(field?.options)
    ? (field!.options as unknown[]).map((o) => String(o ?? '').trim()).filter(Boolean)
    : [];
  if (custom.length > 0) return custom.map((v) => ({ value: v, label: v }));
  return defaultChoices(kind);
}

export type TelecrmPropertyChoiceResolver = {
  options: TelecrmPropertyChoiceOptions;
  /** 저장값(OPT_2·아파트 등)을 사람이 읽는 이름으로. 이름을 모르는 코드는 빈 문자 */
  labelOf: (kind: ChoiceKind, raw: string | null | undefined) => string;
};

function dedupe(list: TelecrmPropertyChoiceOption[]): TelecrmPropertyChoiceOption[] {
  const seen = new Set<string>();
  const out: TelecrmPropertyChoiceOption[] = [];
  for (const o of list) {
    if (seen.has(o.value)) continue;
    seen.add(o.value);
    if (looksLikeMachineChoiceCode(o.label)) continue;
    out.push(o);
  }
  return out;
}

export async function loadTelecrmPropertyChoiceResolver(tenantId: string): Promise<TelecrmPropertyChoiceResolver> {
  let templates: (TemplateRow & { isDefault: boolean; status: string })[] = [];
  try {
    templates = await prisma.orderFormTemplate.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        isDefault: true,
        status: true,
        customerWizardJson: true,
        fields: {
          where: { systemField: { in: ['propertyType', 'buildingType'] } },
          select: { systemField: true, options: true },
        },
      },
    });
  } catch (e) {
    console.error('[telecrm-property-choices] template load failed', e instanceof Error ? e.message : e);
  }

  const primary =
    templates.find((t) => t.isDefault && t.status !== 'ARCHIVED') ??
    templates.find((t) => t.status === 'PUBLISHED') ??
    templates[0] ??
    null;

  const build = (kind: ChoiceKind) => {
    const main = primary ? choicesForTemplate(primary, kind) : defaultChoices(kind);
    const lookup = dedupe([
      ...main,
      ...templates.filter((t) => t !== primary).flatMap((t) => choicesForTemplate(t, kind)),
      ...defaultChoices(kind),
    ]);
    return { main: dedupe(main), lookup };
  };
  const property = build('property');
  const building = build('building');

  const labelOf = (kind: ChoiceKind, raw: string | null | undefined): string => {
    const text = String(raw ?? '').trim();
    if (!text) return '';
    const pool = kind === 'property' ? property.lookup : building.lookup;
    const upper = text.toUpperCase();
    const found =
      pool.find((o) => o.value === text) ??
      pool.find((o) => o.value.toUpperCase() === upper) ??
      pool.find((o) => o.label === text);
    if (found) return found.label;
    return looksLikeMachineChoiceCode(text) ? '' : text;
  };

  return {
    options: { propertyTypes: property.main, buildingTypes: building.main },
    labelOf,
  };
}
