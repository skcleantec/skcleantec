/**
 * 스테이징(소스) → 운영(대상) 단일 접수(+발주서) 복사.
 *
 * 사용 (Railway 공개 Proxy URL, sslmode=require):
 *   $env:SKCT_SOURCE_DATABASE_URL = '<staging>'
 *   $env:SKCT_TARGET_DATABASE_URL = '<production>'
 *   cd server
 *   npx tsx scripts/copy-inquiry-between-databases.ts --inquiry-number sk2606250001 --tenant-slug sk
 *
 * 옵션:
 *   --dry-run          대상 DB 쓰기 없음
 *   --cancel-source    복사 성공 후 소스 접수 CANCELLED + 변경 로그
 *   --inquiry-number   (기본 sk2606250001)
 *   --tenant-slug      (기본 sk)
 *
 * 연결 문자열을 git·채팅에 넣지 마세요.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const cancelSource = args.includes('--cancel-source');
const inquiryNumber =
  args.find((a, i) => args[i - 1] === '--inquiry-number') ?? 'sk2606250001';
const tenantSlug = args.find((a, i) => args[i - 1] === '--tenant-slug') ?? 'sk';

const sourceUrl = process.env.SKCT_SOURCE_DATABASE_URL ?? process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.SKCT_TARGET_DATABASE_URL ?? process.env.TARGET_DATABASE_URL;

if (!sourceUrl || !targetUrl) {
  console.error(
    'SKCT_SOURCE_DATABASE_URL(스테이징)와 SKCT_TARGET_DATABASE_URL(운영) 환경변수가 필요합니다.',
  );
  process.exit(1);
}

if (sourceUrl === targetUrl) {
  console.error('소스와 대상 DATABASE_URL이 동일합니다. 중단합니다.');
  process.exit(1);
}

const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
const target = new PrismaClient({ datasources: { db: { url: targetUrl } } });

function strip<T extends Record<string, unknown>>(row: T, omit: (keyof T)[]): Omit<T, (typeof omit)[number]> {
  const out = { ...row };
  for (const k of omit) delete out[k];
  return out as Omit<T, (typeof omit)[number]>;
}

function parseInquiryNumberCounter(inquiryNum: string): { dateKey: string; seq: number } | null {
  const m = inquiryNum.match(/^[a-zA-Z]*(\d{6})(\d{4})$/);
  if (!m) return null;
  return { dateKey: `20${m[1]}`, seq: parseInt(m[2]!, 10) };
}

async function resolveTargetTenantId(slug: string): Promise<string> {
  const row = await target.tenant.findFirst({ where: { slug }, select: { id: true, name: true } });
  if (!row) throw new Error(`대상 DB에 tenant slug="${slug}" 없음`);
  console.info(`[target] tenant: ${row.name} (${row.id})`);
  return row.id;
}

async function mapOperatingCompanyId(
  sourceOcId: string,
  sourceTenantId: string,
  targetTenantId: string,
): Promise<string> {
  const src = await source.operatingCompany.findFirst({
    where: { id: sourceOcId, tenantId: sourceTenantId },
    select: { slug: true, name: true },
  });
  if (!src) throw new Error(`소스 operatingCompany ${sourceOcId} 없음`);
  const tgt = await target.operatingCompany.findFirst({
    where: { tenantId: targetTenantId, slug: src.slug },
    select: { id: true },
  });
  if (!tgt) {
    throw new Error(
      `대상 DB에 operatingCompany slug="${src.slug}" (${src.name}) 없음 — 먼저 운영에 동일 브랜드를 만드세요.`,
    );
  }
  return tgt.id;
}

async function mapUserByEmail(
  sourceUserId: string,
  sourceTenantId: string,
  targetTenantId: string,
  label: string,
): Promise<string> {
  const src = await source.user.findFirst({
    where: { id: sourceUserId, tenantId: sourceTenantId },
    select: { email: true, name: true, role: true },
  });
  if (!src) throw new Error(`소스 user ${sourceUserId} (${label}) 없음`);
  const tgt = await target.user.findFirst({
    where: { tenantId: targetTenantId, email: src.email },
    select: { id: true },
  });
  if (!tgt) {
    throw new Error(
      `대상 DB에 user email="${src.email}" (${src.name}, ${src.role}) 없음 — ${label}`,
    );
  }
  return tgt.id;
}

async function mapOptionalUser(
  sourceUserId: string | null | undefined,
  sourceTenantId: string,
  targetTenantId: string,
  label: string,
): Promise<string | null> {
  if (!sourceUserId) return null;
  return mapUserByEmail(sourceUserId, sourceTenantId, targetTenantId, label);
}

async function mapTemplateId(
  sourceTemplateId: string | null,
  sourceTenantId: string,
  targetTenantId: string,
): Promise<string | null> {
  if (!sourceTemplateId) return null;
  const src = await source.orderFormTemplate.findFirst({
    where: { id: sourceTemplateId, tenantId: sourceTenantId },
    select: { title: true, isDefault: true },
  });
  if (!src) return null;
  const tgt = await target.orderFormTemplate.findFirst({
    where: {
      tenantId: targetTenantId,
      OR: [{ isDefault: true }, { title: src.title }],
    },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
    select: { id: true, title: true },
  });
  if (!tgt) {
    console.warn(`[warn] 대상 템플릿 매칭 실패 — templateId null (${src.title})`);
    return null;
  }
  console.info(`[map] template → ${tgt.title}`);
  return tgt.id;
}

async function mapExternalCompanyId(
  sourceEcId: string | null | undefined,
  sourceTenantId: string,
  targetTenantId: string,
): Promise<string | null> {
  if (!sourceEcId) return null;
  const src = await source.externalCompany.findFirst({
    where: { id: sourceEcId, tenantId: sourceTenantId },
    select: { name: true },
  });
  if (!src) return null;
  const tgt = await target.externalCompany.findFirst({
    where: { tenantId: targetTenantId, name: src.name },
    select: { id: true },
  });
  if (!tgt) {
    console.warn(`[warn] 대상 externalCompany "${src.name}" 없음 — null`);
    return null;
  }
  return tgt.id;
}

async function bumpDailyCounter(
  tx: Prisma.TransactionClient,
  tenantId: string,
  operatingCompanyId: string,
  inquiryNum: string,
) {
  const parsed = parseInquiryNumberCounter(inquiryNum);
  if (!parsed) return;
  await tx.$executeRaw`
    INSERT INTO daily_inquiry_counters (tenant_id, operating_company_id, date_key, last_seq)
    VALUES (${tenantId}, ${operatingCompanyId}, ${parsed.dateKey}, ${parsed.seq})
    ON CONFLICT (tenant_id, operating_company_id, date_key) DO UPDATE
    SET last_seq = GREATEST(daily_inquiry_counters.last_seq, ${parsed.seq})
  `;
}

async function main() {
  console.info(`[copy] inquiryNumber=${inquiryNumber} tenantSlug=${tenantSlug} dryRun=${dryRun}`);

  const sourceTenant = await source.tenant.findFirst({
    where: { slug: tenantSlug },
    select: { id: true, name: true },
  });
  if (!sourceTenant) throw new Error(`소스 DB에 tenant slug="${tenantSlug}" 없음`);
  console.info(`[source] tenant: ${sourceTenant.name}`);

  const inq = await source.inquiry.findFirst({
    where: { tenantId: sourceTenant.id, inquiryNumber },
    include: {
      orderForm: {
        include: {
          photos: true,
          submissionEmailLog: true,
          reviewPaybackRequest: true,
        },
      },
      consultationPhotos: true,
      changeLogs: true,
      statusEvents: true,
      assignments: true,
      extraCharges: true,
      additionalReceipts: true,
      createdBy: { select: { email: true, name: true } },
    },
  });

  if (!inq) {
    throw new Error(`소스 DB에 접수번호 "${inquiryNumber}" 없음 (tenant ${tenantSlug})`);
  }

  console.info(
    `[source] found: ${inq.customerName} / ${inq.inquiryNumber} / status=${inq.status} / id=${inq.id}`,
  );
  if (inq.orderForm) {
    console.info(
      `[source] orderForm: token=${inq.orderForm.token.slice(0, 8)}… submitted=${inq.orderForm.submittedAt?.toISOString() ?? 'null'}`,
    );
  }

  const targetTenantId = await resolveTargetTenantId(tenantSlug);

  const dup = await target.inquiry.findFirst({
    where: { tenantId: targetTenantId, inquiryNumber },
    select: { id: true, customerName: true },
  });
  if (dup) {
    throw new Error(
      `대상 DB에 이미 접수번호 "${inquiryNumber}" 존재 (${dup.customerName}, id=${dup.id})`,
    );
  }

  const idConflict = await target.inquiry.findUnique({ where: { id: inq.id }, select: { id: true } });
  if (idConflict) {
    throw new Error(`대상 DB에 inquiry id ${inq.id} 가 이미 있음 — UUID 충돌`);
  }

  if (inq.orderForm) {
    const ofDup = await target.orderForm.findUnique({
      where: { token: inq.orderForm.token },
      select: { id: true },
    });
    if (ofDup) {
      throw new Error(`대상 DB에 orderForm token 충돌 (id=${ofDup.id})`);
    }
    const ofIdDup = await target.orderForm.findUnique({
      where: { id: inq.orderForm.id },
      select: { id: true },
    });
    if (ofIdDup) {
      throw new Error(`대상 DB에 orderForm id ${inq.orderForm.id} 충돌`);
    }
  }

  const targetOcId = await mapOperatingCompanyId(
    inq.operatingCompanyId,
    sourceTenant.id,
    targetTenantId,
  );
  const targetCreatedById = await mapOptionalUser(
    inq.createdById,
    sourceTenant.id,
    targetTenantId,
    'createdBy',
  );
  const targetCancelFeeEcId = await mapExternalCompanyId(
    inq.cancelFeeExternalCompanyId,
    sourceTenant.id,
    targetTenantId,
  );

  let targetOrderFormOcId = targetOcId;
  if (inq.orderForm?.operatingCompanyId && inq.orderForm.operatingCompanyId !== inq.operatingCompanyId) {
    targetOrderFormOcId = await mapOperatingCompanyId(
      inq.orderForm.operatingCompanyId,
      sourceTenant.id,
      targetTenantId,
    );
  }

  let targetOrderFormCreatedById: string | null = null;
  let targetTemplateId: string | null = null;

  const userMap = new Map<string, string>();
  async function mappedUser(sourceUserId: string | null | undefined, label: string): Promise<string | null> {
    if (!sourceUserId) return null;
    const cached = userMap.get(sourceUserId);
    if (cached) return cached;
    const id = await mapUserByEmail(sourceUserId, sourceTenant.id, targetTenantId, label);
    userMap.set(sourceUserId, id);
    return id;
  }

  if (inq.orderForm) {
    targetOrderFormCreatedById = await mappedUser(
      inq.orderForm.createdById,
      'orderForm.createdBy',
    ) as string;
    targetTemplateId = await mapTemplateId(
      inq.orderForm.templateId,
      sourceTenant.id,
      targetTenantId,
    );
  }

  for (const p of inq.consultationPhotos) {
    await mappedUser(p.uploadedById, 'consultationPhoto.uploadedBy');
  }
  for (const log of inq.changeLogs) {
    await mappedUser(log.actorId, 'changeLog.actor');
  }
  for (const ev of inq.statusEvents) {
    await mappedUser(ev.actorId, 'statusEvent.actor');
  }
  for (const a of inq.assignments) {
    await mappedUser(a.teamLeaderId, 'assignment.teamLeader');
    await mappedUser(a.assignedById, 'assignment.assignedBy');
  }
  for (const c of inq.extraCharges) {
    await mappedUser(c.createdById, 'extraCharge.createdBy');
  }
  for (const r of inq.additionalReceipts) {
    await mappedUser(r.createdById, 'additionalReceipt.createdBy');
  }
  if (inq.orderForm?.reviewPaybackRequest?.handledById) {
    await mappedUser(inq.orderForm.reviewPaybackRequest.handledById, 'reviewPayback.handledBy');
  }

  if (dryRun) {
    console.info('[dry-run] 사전 검증 통과 — 실제 복사는 --dry-run 없이 실행하세요.');
    return;
  }

  await target.$transaction(async (tx) => {
    if (inq.orderForm) {
      const of = inq.orderForm;
      await tx.orderForm.create({
        data: {
          ...strip(of, [
            'photos',
            'submissionEmailLog',
            'reviewPaybackRequest',
            'inquiries',
            'createdBy',
            'template',
            'operatingCompany',
            'tenant',
          ]),
          tenantId: targetTenantId,
          operatingCompanyId: targetOrderFormOcId,
          createdById: targetOrderFormCreatedById!,
          templateId: targetTemplateId,
        },
      });

      for (const p of of.photos) {
        await tx.orderFormPhoto.create({
          data: strip(p, ['orderForm']),
        });
      }

      if (of.submissionEmailLog) {
        const log = of.submissionEmailLog;
        await tx.orderFormSubmissionEmailLog.create({
          data: {
            ...strip(log, ['orderForm', 'tenant']),
            tenantId: targetTenantId,
            operatingCompanyId: log.operatingCompanyId ? targetOrderFormOcId : null,
          },
        });
      }

      if (of.reviewPaybackRequest) {
        const rp = of.reviewPaybackRequest;
        await tx.reviewPaybackRequest.create({
          data: {
            ...strip(rp, ['orderForm', 'inquiry', 'tenant', 'handledBy']),
            tenantId: targetTenantId,
            inquiryId: inq.id,
            orderFormId: of.id,
            handledById: rp.handledById ? userMap.get(rp.handledById) ?? null : null,
          },
        });
      }
    }

    await tx.inquiry.create({
      data: {
        ...strip(inq, [
          'orderForm',
          'createdBy',
          'assignments',
          'consultationPhotos',
          'changeLogs',
          'statusEvents',
          'extraCharges',
          'additionalReceipts',
          'cancelFeeExternalCompany',
          'operatingCompany',
          'tenant',
        ]),
        tenantId: targetTenantId,
        operatingCompanyId: targetOcId,
        createdById: targetCreatedById,
        cancelFeeExternalCompanyId: targetCancelFeeEcId,
        orderFormId: inq.orderFormId,
      },
    });

    for (const p of inq.consultationPhotos) {
      await tx.inquiryConsultationPhoto.create({
        data: {
          ...strip(p, ['inquiry', 'uploadedBy']),
          uploadedById: userMap.get(p.uploadedById)!,
        },
      });
    }

    for (const log of inq.changeLogs) {
      await tx.inquiryChangeLog.create({
        data: {
          ...strip(log, ['inquiry', 'actor']),
          actorId: log.actorId ? userMap.get(log.actorId) ?? null : null,
        },
      });
    }

    for (const ev of inq.statusEvents) {
      await tx.inquiryStatusEvent.create({
        data: {
          ...strip(ev, ['inquiry', 'tenant', 'actor']),
          tenantId: targetTenantId,
          actorId: ev.actorId ? userMap.get(ev.actorId) ?? null : null,
        },
      });
    }

    for (const a of inq.assignments) {
      await tx.assignment.create({
        data: {
          ...strip(a, ['inquiry', 'teamLeader', 'assignedBy']),
          tenantId: targetTenantId,
          teamLeaderId: userMap.get(a.teamLeaderId)!,
          assignedById: userMap.get(a.assignedById)!,
        },
      });
    }

    for (const c of inq.extraCharges) {
      await tx.inquiryExtraCharge.create({
        data: {
          ...strip(c, ['inquiry', 'createdBy']),
          createdById: c.createdById ? userMap.get(c.createdById) ?? null : null,
        },
      });
    }

    for (const r of inq.additionalReceipts) {
      await tx.inquiryAdditionalReceipt.create({
        data: {
          ...strip(r, ['inquiry', 'createdBy']),
          createdById: r.createdById ? userMap.get(r.createdById) ?? null : null,
        },
      });
    }

    if (inq.inquiryNumber) {
      await bumpDailyCounter(tx, targetTenantId, targetOcId, inq.inquiryNumber);
    }
  });

  console.info(`[ok] 운영 DB에 복사 완료: ${inquiryNumber} (${inq.customerName}) id=${inq.id}`);

  if (cancelSource) {
    await source.inquiry.update({
      where: { id: inq.id },
      data: { status: 'CANCELLED' },
    });
    await source.inquiryChangeLog.create({
      data: {
        inquiryId: inq.id,
        customerName: inq.customerName,
        actorId: null,
        lines: [`[운영 이전] 접수번호 ${inquiryNumber} — 운영(main) DB로 단건 복사됨`],
      },
    });
    console.info('[ok] 소스 접수 CANCELLED 처리');
  }
}

main()
  .catch((e) => {
    console.error('[copy] 실패:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
