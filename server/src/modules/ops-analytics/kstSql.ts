import { Prisma } from '@prisma/client';

/**
 * Prisma `DateTime` on PostgreSQL → `timestamp(3) without time zone` (UTC instant as naive).
 * KST wall clock for EXTRACT / display:
 *   (col AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul'
 */
export function sqlKstWallClock(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`((${column} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')`;
}

export function sqlExtractKstHour(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`EXTRACT(HOUR FROM ${sqlKstWallClock(column)})::int`;
}

export function sqlExtractKstDow(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`EXTRACT(DOW FROM ${sqlKstWallClock(column)})::int`;
}

/** 발주서 목록·집계에서 제외하는 디자이너 미리보기 토큰 */
export const DESIGNER_PREVIEW_TOKEN_LIKE = 'designer-preview-%';

export function sqlExcludeDesignerPreviewTokens(column: Prisma.Sql = Prisma.sql`token`): Prisma.Sql {
  return Prisma.sql`${column} NOT LIKE ${DESIGNER_PREVIEW_TOKEN_LIKE}`;
}
