import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  sqlExcludeDesignerPreviewTokens,
  sqlExtractKstHour,
} from './kstSql.js';

export async function orderFormIdsMatchingKstHour(params: {
  tenantId: string;
  gte: Date;
  lte: Date;
  kstHour: number;
  timeColumn: 'created_at' | 'submitted_at';
}): Promise<string[]> {
  const { tenantId, gte, lte, kstHour, timeColumn } = params;
  if (timeColumn === 'submitted_at') {
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id
      FROM order_forms
      WHERE tenant_id = ${tenantId}
        AND submitted_at IS NOT NULL
        AND submitted_at >= ${gte}
        AND submitted_at <= ${lte}
        AND ${sqlExcludeDesignerPreviewTokens()}
        AND ${sqlExtractKstHour(Prisma.sql`submitted_at`)} = ${kstHour}
    `);
    return rows.map((r) => r.id);
  }
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id
    FROM order_forms
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${gte}
      AND created_at <= ${lte}
      AND ${sqlExcludeDesignerPreviewTokens()}
      AND ${sqlExtractKstHour(Prisma.sql`created_at`)} = ${kstHour}
  `);
  return rows.map((r) => r.id);
}

export async function orderFollowupIdsMatchingKstHour(params: {
  tenantId: string;
  gte: Date;
  lte: Date;
  kstHour: number;
  status?: string;
}): Promise<string[]> {
  const { tenantId, gte, lte, kstHour, status } = params;
  const rows =
    status != null
      ? await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id
          FROM order_followups
          WHERE tenant_id = ${tenantId}
            AND status = ${status}::"OrderFollowupStatus"
            AND created_at >= ${gte}
            AND created_at <= ${lte}
            AND ${sqlExtractKstHour(Prisma.sql`created_at`)} = ${kstHour}
        `)
      : await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id
          FROM order_followups
          WHERE tenant_id = ${tenantId}
            AND created_at >= ${gte}
            AND created_at <= ${lte}
            AND ${sqlExtractKstHour(Prisma.sql`created_at`)} = ${kstHour}
        `);
  return rows.map((r) => r.id);
}

export async function inquiryIdsMatchingStatusEventKstHour(params: {
  tenantId: string;
  gte: Date;
  lte: Date;
  kstHour: number;
  status: string;
}): Promise<string[]> {
  const { tenantId, gte, lte, kstHour, status } = params;
  const rows = await prisma.$queryRaw<{ inquiry_id: string }[]>(Prisma.sql`
    SELECT DISTINCT inquiry_id
    FROM inquiry_status_events
    WHERE tenant_id = ${tenantId}
      AND status = ${status}::"InquiryStatus"
      AND occurred_at >= ${gte}
      AND occurred_at <= ${lte}
      AND ${sqlExtractKstHour(Prisma.sql`occurred_at`)} = ${kstHour}
  `);
  return rows.map((r) => r.inquiry_id);
}
