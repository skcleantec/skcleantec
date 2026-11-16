/**
 * 읽기 전용. 제출 발주서 중 고객 특이사항이 제출 스냅샷과 다르고,
 * 그 값이 같은 접수 내부 메모(specialNotes)와 같거나 그 일부인 건을 찾는다.
 *
 * 고객 문구 원문은 출력하지 않는다. 업체 slug·접수번호·건수만 출력한다.
 * 실행: cd server; npx tsx scripts/find-mixed-customer-special-notes.ts
 */
import { pathToFileURL } from 'node:url';

export function snapshotSubmittedSpecialNotes(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return '';
  const fields = (snapshot as { fields?: unknown }).fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return '';
  const value = (fields as { specialNotes?: unknown }).specialNotes;
  if (value == null) return '';
  return String(value).trim();
}

/** customerSpecialNotes 가 제출값과 다르고, 내부 메모와 같거나 내부 메모의 일부인지 */
export function isSubmittedCustomerNotesMixedWithInternal(opts: {
  customerSpecialNotes: string | null | undefined;
  submittedSpecialNotes: string | null | undefined;
  inquirySpecialNotes: string | null | undefined;
}): boolean {
  const customer = String(opts.customerSpecialNotes ?? '').trim();
  const submitted = String(opts.submittedSpecialNotes ?? '').trim();
  const internal = String(opts.inquirySpecialNotes ?? '').trim();
  if (customer === submitted) return false;
  if (!customer || !internal) return false;
  return customer === internal || internal.includes(customer);
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

async function main(): Promise<void> {
  const { prisma } = await import('../src/lib/prisma.js');
  try {
    const rows = await prisma.inquiry.findMany({
      where: { orderForm: { is: { submittedAt: { not: null } } } },
      select: {
        inquiryNumber: true,
        specialNotes: true,
        tenant: { select: { slug: true } },
        orderForm: {
          select: {
            customerSpecialNotes: true,
            customerSubmissionSnapshot: true,
          },
        },
      },
    });

    const hits: { slug: string; inquiryNumber: string }[] = [];
    for (const row of rows) {
      const form = row.orderForm;
      if (!form) continue;
      const mixed = isSubmittedCustomerNotesMixedWithInternal({
        customerSpecialNotes: form.customerSpecialNotes,
        submittedSpecialNotes: snapshotSubmittedSpecialNotes(form.customerSubmissionSnapshot),
        inquirySpecialNotes: row.specialNotes,
      });
      if (!mixed) continue;
      hits.push({
        slug: row.tenant.slug,
        inquiryNumber: row.inquiryNumber?.trim() || '-',
      });
    }

    const bySlug = new Map<string, number>();
    console.log('업체\t접수번호');
    for (const hit of hits) {
      console.log(`${hit.slug}\t${hit.inquiryNumber}`);
      bySlug.set(hit.slug, (bySlug.get(hit.slug) ?? 0) + 1);
    }
    console.log('업체\t건수');
    for (const [slug, count] of bySlug) {
      console.log(`${slug}\t${count}`);
    }
    console.log(`전체\t${hits.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (isDirectRun()) {
  main().catch(() => {
    console.error('조회에 실패했습니다.');
    process.exit(1);
  });
}
