/**
 * 이번 달 스케줄용 접수·랜덤 팀장 배정 샘플을 약 40건 삽입합니다.
 * 동일 월에 재실행 시, 같은 태그로 만든 기존 건을 먼저 삭제한 뒤 다시 넣습니다.
 *
 * 실행: cd server && npm run db:seed:schedule
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { pickCreatedByIdForSeed } from '../scripts/schedule-mar-may-seed.logic.js';

const prisma = new PrismaClient();

const COUNT = 40;

const TIME_SLOTS = ['오전', '오후', '사이청소'] as const;
const SOURCES = ['전화', '네이버', '인스타그램', '배너', '기타'];
const STREETS = [
  '서울 송파구 올림픽로 300',
  '경기 성남시 분당구 판교역로 146',
  '인천 연수구 컨벤시아대로 204',
  '서울 마포구 월드컵북로 396',
  '서울 강남구 테헤란로 152',
  '경기 성남시 수정구 성남대로 997',
  '서울 영등포구 여의대로 108',
  '부산 해운대구 센텀중앙로 97',
];

const FAMILY = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '홍', '유'];
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

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const leaders = await prisma.user.findMany({
    where: { role: 'TEAM_LEADER', isActive: true },
    select: { id: true, name: true },
  });
  if (!admin) {
    throw new Error('관리자 계정이 없습니다. npm run db:seed 를 먼저 실행하세요.');
  }
  if (leaders.length === 0) {
    throw new Error('팀장 계정이 없습니다. npm run db:seed 를 먼저 실행하세요.');
  }

  const marketers = await prisma.user.findMany({
    where: { role: 'MARKETER', isActive: true },
    select: { id: true },
  });

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthKey = `${y}-${pad2(m + 1)}`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const tag = `[스케줄랜덤시드 ${monthKey}]`;

  const deleted = await prisma.inquiry.deleteMany({
    where: { memo: { contains: tag } },
  });
  if (deleted.count > 0) {
    console.log(`기존 시드 삭제: ${deleted.count}건 (${tag})`);
  }

  for (let i = 0; i < COUNT; i++) {
    const day = randomInt(1, lastDay);
    const preferredDate = new Date(`${y}-${pad2(m + 1)}-${pad2(day)}T12:00:00+09:00`);
    const teamLeader = randomItem(leaders);
    const name = `${randomItem(FAMILY)}${randomItem(GIVEN)}`;
    const phone = `010-${randomInt(8000, 9999)}-${randomInt(1000, 9999)}`;
    const createdById = pickCreatedByIdForSeed(admin.id, marketers);

    await prisma.$transaction(async (tx) => {
      const inquiry = await tx.inquiry.create({
        data: {
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
          status: 'ASSIGNED',
          source: randomItem(SOURCES),
          serviceTotalAmount: randomInt(45, 95) * 10000,
          serviceDepositAmount: 20000,
          serviceBalanceAmount: randomInt(40, 90) * 10000,
        },
      });

      await tx.assignment.create({
        data: {
          inquiryId: inquiry.id,
          teamLeaderId: teamLeader.id,
          assignedById: admin.id,
        },
      });
    });
  }

  console.log(`OK: ${COUNT}건 삽입 (${monthKey}, 팀장 ${leaders.length}명 중 랜덤 배정)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
