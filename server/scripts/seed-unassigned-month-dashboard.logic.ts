/**
 * 대시보드「이번달 미분배」집계용: 접수일(createdAt) KST 이번 달 + status RECEIVED + 팀장 배정 없음.
 * @see server/src/modules/dashboard/dashboard.routes.ts
 */
import type { PrismaClient } from '@prisma/client';
import { allocateNextInquiryNumber } from '../src/modules/inquiries/inquiryNumber.js';
import { kstMonthRangeYm, kstTodayYmd } from '../src/modules/inquiries/inquiryListDateRange.js';
import { pickCreatedByIdForSeed } from './schedule-mar-may-seed.logic.js';

const DEFAULT_COUNT = 20;

const TIME_SLOTS = ['오전', '오후', '사이청소'] as const;
const SOURCES = ['전화', '네이버', '인스타그램', '배너', '기타'];
const STREETS = [
  '서울 송파구 올림픽로 300',
  '경기 성남시 분당구 판교역로 146',
  '인천 연수구 컨벤시아대로 204',
  '서울 마포구 월드컵북로 396',
  '서울 강남구 테헤란로 152',
];

const FAMILY = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
const GIVEN = [
  '민준', '서연', '도윤', '하은', '시우', '지우', '수빈', '예준', '채원', '준서',
  '서준', '지안', '하준', '유진', '시윤', '연우', '다은', '주원', '소율', '태양',
];

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function tagUnassignedMonthTest(monthKey: string): string {
  return `[미분배테스트 KST-${monthKey}]`;
}

export async function purgeUnassignedMonthTest(prisma: PrismaClient, monthKey: string): Promise<number> {
  const tag = tagUnassignedMonthTest(monthKey);
  const deleted = await prisma.inquiry.deleteMany({
    where: { memo: { contains: tag } },
  });
  return deleted.count;
}

/** 이번 달 KST 내 임의 시각(집계 구간 안) */
function randomCreatedAtThisMonth(monthKey: string): Date {
  const range = kstMonthRangeYm(monthKey);
  if (!range) throw new Error('이번 달 구간을 계산할 수 없습니다.');
  const span = range.lte.getTime() - range.gte.getTime();
  return new Date(range.gte.getTime() + Math.floor(Math.random() * (span + 1)));
}

function randomPreferredDateInMonth(monthKey: string): Date {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) throw new Error('monthKey');
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const lastDay = new Date(y, mo, 0).getDate();
  const day = randomInt(1, lastDay);
  return new Date(`${y}-${pad2(mo)}-${pad2(day)}T12:00:00+09:00`);
}

export async function runUnassignedMonthDashboardSeed(
  prisma: PrismaClient,
  opts: { count?: number; monthKey?: string },
): Promise<void> {
  const monthKey = opts.monthKey ?? kstTodayYmd().slice(0, 7);
  const count = Math.max(1, opts.count ?? DEFAULT_COUNT);

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const marketers = await prisma.user.findMany({
    where: { role: 'MARKETER', isActive: true },
    select: { id: true },
  });
  if (!admin) {
    throw new Error('관리자 계정이 없습니다.');
  }

  const tag = tagUnassignedMonthTest(monthKey);
  const removed = await purgeUnassignedMonthTest(prisma, monthKey);
  if (removed > 0) {
    console.log(`기존 미분배 시드 삭제: ${removed}건 (${tag})`);
  }

  for (let i = 0; i < count; i++) {
    const createdAt = randomCreatedAtThisMonth(monthKey);
    const preferredDate = randomPreferredDateInMonth(monthKey);
    const name = `${randomItem(FAMILY)}${randomItem(GIVEN)}`;
    const phone = `010-${randomInt(8000, 9999)}-${randomInt(1000, 9999)}`;
    const createdById = pickCreatedByIdForSeed(admin.id, marketers);

    await prisma.$transaction(async (tx) => {
      const inquiryNumber = await allocateNextInquiryNumber(tx);
      await tx.inquiry.create({
        data: {
          inquiryNumber,
          customerName: name,
          customerPhone: phone,
          createdById,
          address: randomItem(STREETS),
          addressDetail: `${randomInt(1, 25)}동 ${randomInt(101, 2505)}호`,
          areaPyeong: randomInt(18, 42),
          propertyType: randomItem(['아파트', '오피스텔', '빌라(연립)']),
          roomCount: randomInt(2, 4),
          bathroomCount: randomInt(1, 2),
          balconyCount: randomInt(0, 2),
          preferredDate,
          preferredTime: randomItem(TIME_SLOTS),
          preferredTimeDetail: `${pad2(randomInt(9, 11))}:00~${pad2(randomInt(14, 17))}:00`,
          callAttempt: randomInt(1, 3),
          memo: `${tag} #${i + 1}`,
          status: 'RECEIVED',
          source: randomItem(SOURCES),
          serviceTotalAmount: randomInt(45, 95) * 10000,
          serviceDepositAmount: 20000,
          serviceBalanceAmount: randomInt(40, 90) * 10000,
          createdAt,
        },
      });
    });
  }

  console.log(
    `OK: 미분배(대시보드) ${count}건 · KST ${monthKey} · RECEIVED · 팀장 미배정 · ${tag}`,
  );
}
