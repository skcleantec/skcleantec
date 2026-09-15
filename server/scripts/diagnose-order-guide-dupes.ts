/**
 * 저장된 안내사항에서 전일 30% 문구가 치환 후 몇 번 나오는지 스캔 (읽기 전용)
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import {
  buildGuidePlaceholderContextFromPolicy,
  ensureCancellationPolicyPlaceholderInSections,
  expandGuidePlaceholders,
  expandGuideSectionItems,
} from '../src/lib/orderFormGuidePlaceholders.js';
import { resolveOperatingCompanyCancellationPolicy } from '../src/lib/operatingCompanyCancellationPolicyCore.js';

const PRE =
  '고객님 사정으로 전일 청소 예약 취소 또는 변경 시 청소비 위약금 30%가 적용됩니다.';
const SAME =
  '고객님 사정으로 당일 청소 예약 취소 또는 변경 시 청소비 위약금 50%가 적용됩니다.';

function parseSections(raw: string | null | undefined): { title: string; items: string[] }[] {
  if (!raw?.trim()) return [];
  try {
    const p = JSON.parse(raw) as { sections?: { title?: string; items?: string[] }[] };
    if (!Array.isArray(p.sections)) return [];
    return p.sections.map((s) => ({
      title: String(s.title ?? ''),
      items: Array.isArray(s.items) ? s.items.map((x) => String(x)) : [],
    }));
  } catch {
    return [];
  }
}

async function main() {
  const configs = await prisma.orderFormConfig.findMany({
    select: { tenantId: true, infoContent: true },
  });
  let tenantsWithPre = 0;
  let tenantsDupAfterOldExpand = 0;
  let tenantsDupAfterFix = 0;
  let tenantsMissingSameDayInPolicy = 0;

  for (const row of configs) {
    const raw = parseSections(row.infoContent);
    const cancel = raw.find((s) => /취소|변경/.test(s.title));
    if (!cancel) continue;
    const hasPreInStore = cancel.items.some((l) => l.includes('전일') && l.includes('30%'));
    if (!hasPreInStore && !cancel.items.some((l) => l.includes('{{cancellationPolicy}}'))) continue;

    const brand = await prisma.operatingCompany.findFirst({
      where: { tenantId: row.tenantId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
      select: { config: true },
    });
    const policy = resolveOperatingCompanyCancellationPolicy(
      (brand?.config as { cancellationPolicy?: unknown } | null)?.cancellationPolicy,
    );
    const ctx = buildGuidePlaceholderContextFromPolicy(policy);
    const afterOldEnsure = (() => {
      const items = [...cancel.items];
      if (!items.some((l) => l.includes('{{cancellationPolicy}}'))) {
        items.unshift('{{cancellationPolicy}}');
      }
      return items;
    })();
    const oldExpanded: string[] = [];
    for (const item of afterOldEnsure) {
      const expanded = expandGuidePlaceholders(item, ctx);
      for (const line of expanded.split('\n')) {
        const t = line.trim();
        if (t) oldExpanded.push(t);
      }
    }
    const oldPre = oldExpanded.filter((l) => l === PRE).length;
    const fixed = ensureCancellationPolicyPlaceholderInSections([{ ...cancel }]);
    const newExpanded = expandGuideSectionItems(fixed[0]!.items, ctx);
    const newPre = newExpanded.filter((l) => l === PRE).length;
    const newSame = newExpanded.filter((l) => l === SAME || l.includes('당일')).length;

    if (hasPreInStore || oldPre > 0) tenantsWithPre += 1;
    if (oldPre > 1) {
      tenantsDupAfterOldExpand += 1;
      console.log(
        JSON.stringify({
          tenantId: row.tenantId,
          storedCancelItems: cancel.items,
          oldPre,
          newPre,
          newSame,
          sameDayTiers: policy.tiers.filter((t) => t.daysBefore === 0).length,
        }),
      );
    }
    if (newPre > 1) tenantsDupAfterFix += 1;
    if (policy.enabled && !policy.tiers.some((t) => t.daysBefore === 0) && newSame === 0) {
      tenantsMissingSameDayInPolicy += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        configRows: configs.length,
        tenantsWithPreDayMention: tenantsWithPre,
        duplicatePreDayBeforeFix: tenantsDupAfterOldExpand,
        duplicatePreDayAfterFix: tenantsDupAfterFix,
        brandsWithoutSameDayTier: tenantsMissingSameDayInPolicy,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
