import type { PrismaClient } from '@prisma/client';

const DEFAULT_SCRIPT_CATEGORIES: { label: string; tabLabel: string; body: string }[] = [
  {
    label: '첫 인사',
    tabLabel: '기본',
    body: `안녕하세요, {고객명}님. 입주·이사 청소 문의 주셔서 연락드렸습니다.

지금 통화 2~3분만 가능하실까요?

(잠시 후) 감사합니다. 편하게 말씀만 주시면, 필요하신 내용 기준으로 견적과 일정까지 안내드리겠습니다.`,
  },
  {
    label: '니즈 파악',
    tabLabel: '기본',
    body: `먼저 상황을 조금 여쭤볼게요.

1) 입주·이사 예정일이 언제쯤이신가요?
2) 거주 형태와 평수는 어떻게 되세요? (아파트/빌라, 방·욕실 개수)
3) 공사·입주 전 상태인가요, 이전 세입자 퇴거 후인가요?
4) 특히 신경 쓰이는 곳 있으세요? (주방 기름때, 욕실 곰팡이, 창틀·베란다, 붙박이장 안쪽 등)
5) 예전에 청소 받아보신 적 있으시면, 아쉬웠던 점도 알려주시면 반영하겠습니다.

가능하시면 현장 사진 2~3장 보내주시면 견적이 더 정확해집니다.`,
  },
  {
    label: '가격 안내',
    tabLabel: '기본',
    body: `{고객명}님, 말씀해 주신 {평수} 기준으로 안내드리면,

▶ 기본 청소 범위
  주방(가구·후드·싱크), 욕실(변기·타일·샤워부스), 거실·방 바닥·몰딩,
  창틀·레일, 베란다 바닥, 현관까지 포함입니다.

▶ 예상 견적
  {평수} 기준 약 {예상가}원

▶ 추가로 비용이 붙을 수 있는 경우 (미리 말씀드립니다)
  · 에어컨·세탁기 분해, 심한 곰팡이·접착제·페인트 자국
  · 붙박이장 대량·대형 가구 이동, 공사 분진이 심한 경우
  → 사진·현장 확인 후 추가 여부를 먼저 합의하고 진행합니다.

견적서에 적힌 금액 그대로 진행하며, 당일 임의 추가 요청은 드리지 않습니다.`,
  },
  {
    label: '반론',
    tabLabel: '기본',
    body: `[비교·고민하신다면]
네, 충분히 비교해 보시는 게 맞습니다.
저희는 평수 기준 포함 범위·투입 인원·AS 기간까지 견적서에 적어드리니,
다른 곳과 범위가 같은지만 같이 봐주시면 됩니다.

[가격이 부담되신다면]
이해합니다. {평수}·오염도·일정에 따라 조정 여지가 있어서,
필수 구역만 먼저 잡거나 옵션을 나눠 드릴 수도 있습니다.
{예상가}에서 조정 가능한지 한번 확인해 드릴게요.

[추가비 걱정]
요즘 추가비 분쟁 많으셔서 걱정되실 텐데,
작업 전 범위·추가 항목·금액을 문자로 남기고, 동의 후에만 진행합니다.`,
  },
  {
    label: '마무리',
    tabLabel: '기본',
    body: `{고객명}님, 정리하면

· 서비스: 입주/이사 청소 ({평수} 기준)
· 예상 금액: {예상가}원
· 희망 일정: ○월 ○일 (○시 전후)

일정 확정을 위해 예약금 5만~10만원(또는 견적의 10~20%)을 받고,
나머지 잔금은 작업 완료·현장 검수 후 결제하시면 됩니다.

▶ 예약 변경·취소 (일반 안내)
  · 3일 전까지: 무료 변경·취소 (예약금 전액 환불)
  · 2~1일 전: 취소·변경 시 위약금 30%
  · 당일 취소·미진행: 위약금 50%
  · 기상·현장 사정으로 일정 조율이 필요하면 미리 연락 주시면 됩니다.

지금 남겨주신 번호로 견적 요약 카톡/문자 보내드려도 될까요?
확인해 주시면 바로 예약 잡아드리겠습니다. 감사합니다!`,
  },
];

const DEFAULT_PRICE_CATEGORIES = ['입주 기본', '추가 옵션', '원·투룸'];

/** SK클린텍·cbiseo.com 기본 테넌트 등 — 빈 본문만 예시 멘트로 채울 때 사용 */
export const PRIORITY_TELECRM_DEFAULT_SCRIPT_TENANT_SLUGS = ['sk', 'skcleanteck', 'cbiseo'] as const;

export type TelecrmDefaultScriptApplyResult = {
  tenantSlug: string;
  createdCategories: number;
  updatedTabs: number;
  skipped: boolean;
  reason?: string;
};

/**
 * 업체 공통 스크립트가 없으면 생성, 기본 5카테고리·「기본」탭 본문이 비어 있으면 예시 멘트를 채운다.
 * 본문이 이미 있는 탭은 덮어쓰지 않는다.
 */
export async function applyTelecrmDefaultSharedScripts(
  prisma: PrismaClient,
  tenantId: string,
): Promise<{ createdCategories: number; updatedTabs: number }> {
  const scriptCount = await prisma.telecrmScriptCategory.count({
    where: { tenantId, ownerUserId: null },
  });

  if (scriptCount === 0) {
    await ensureTelecrmDefaults(prisma, tenantId);
    return { createdCategories: DEFAULT_SCRIPT_CATEGORIES.length, updatedTabs: 0 };
  }

  let updatedTabs = 0;
  for (const row of DEFAULT_SCRIPT_CATEGORIES) {
    const category = await prisma.telecrmScriptCategory.findFirst({
      where: { tenantId, ownerUserId: null, label: row.label },
      include: {
        tabs: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!category) continue;

    const tab =
      category.tabs.find((t) => t.label === row.tabLabel) ?? category.tabs[0];
    if (!tab || tab.body.trim() !== '') continue;

    await prisma.telecrmScriptTab.update({
      where: { id: tab.id },
      data: { body: row.body },
    });
    updatedTabs += 1;
  }

  return { createdCategories: 0, updatedTabs };
}

export async function applyTelecrmDefaultSharedScriptsBySlug(
  prisma: PrismaClient,
  slug: string,
): Promise<TelecrmDefaultScriptApplyResult> {
  const tenant = await prisma.tenant.findFirst({
    where: { slug },
    select: { id: true, slug: true },
  });
  if (!tenant) {
    return {
      tenantSlug: slug,
      createdCategories: 0,
      updatedTabs: 0,
      skipped: true,
      reason: 'tenant_not_found',
    };
  }

  const result = await applyTelecrmDefaultSharedScripts(prisma, tenant.id);
  return {
    tenantSlug: tenant.slug,
    createdCategories: result.createdCategories,
    updatedTabs: result.updatedTabs,
    skipped: false,
  };
}

export async function applyPriorityTelecrmDefaultSharedScripts(
  prisma: PrismaClient,
): Promise<TelecrmDefaultScriptApplyResult[]> {
  const results: TelecrmDefaultScriptApplyResult[] = [];
  for (const slug of PRIORITY_TELECRM_DEFAULT_SCRIPT_TENANT_SLUGS) {
    results.push(await applyTelecrmDefaultSharedScriptsBySlug(prisma, slug));
  }
  return results;
}

/**
 * 테넌트에 텔레CRM 업체 공통 카탈로그가 없으면 기본 카테고리·예시 스크립트를 생성한다.
 * 이미 공통 카테고리가 1개라도 있으면(빈 본문 포함) 건드리지 않는다 — 기존 업체 보호.
 */
export async function ensureTelecrmDefaults(prisma: PrismaClient, tenantId: string): Promise<void> {
  const scriptCount = await prisma.telecrmScriptCategory.count({
    where: { tenantId, ownerUserId: null },
  });
  if (scriptCount === 0) {
    await prisma.$transaction(
      DEFAULT_SCRIPT_CATEGORIES.map((row, index) =>
        prisma.telecrmScriptCategory.create({
          data: {
            tenantId,
            ownerUserId: null,
            label: row.label,
            sortOrder: index,
            tabs: {
              create: {
                tenantId,
                label: row.tabLabel,
                body: row.body,
                sortOrder: 0,
              },
            },
          },
        }),
      ),
    );
  }

  const priceCount = await prisma.telecrmPriceCategory.count({
    where: { tenantId, ownerUserId: null },
  });
  if (priceCount === 0) {
    await prisma.$transaction(
      DEFAULT_PRICE_CATEGORIES.map((label, index) =>
        prisma.telecrmPriceCategory.create({
          data: {
            tenantId,
            ownerUserId: null,
            label,
            sortOrder: index,
          },
        }),
      ),
    );
  }
}
