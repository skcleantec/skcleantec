/**
 * 3·4·5월 범위 랜덤 스케줄 테스트 데이터(접수 + 팀장 배정).
 * 메모에 고정 태그를 넣어 Prisma Studio·스크립트로 일괄 삭제 가능합니다.
 *
 * 삽입(같은 태그로 만든 기존 건은 먼저 삭제 후 재삽입):
 *   cd server && npm run db:seed:schedule:test-m3-m5
 * 웹(Railway) DB에 넣을 때: 해당 환경의 DATABASE_URL을 쓰고 위 명령 실행
 *
 * 일괄 삭제만:
 *   cd server && npm run db:purge:schedule:test-m3-m5
 *
 * 환경변수(선택):
 *   SEED_YEAR — 기본: 올해(예: 2026)
 *   SEED_COUNT — 기본: 90 (3개월에 걸쳐 랜덤 분포)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_COUNT = 90;

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

function tagForYear(year: number): string {
  return `[스케줄테스트 Mar-May ${year}]`;
}

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 3·4·5월 중 하루(해당 월 마지막 일 보정) */
function randomPreferredDate(year: number): Date {
  const month = randomItem([3, 4, 5] as const);
  const lastDay = new Date(year, month, 0).getDate();
  const day = randomInt(1, lastDay);
  return new Date(`${year}-${pad2(month)}-${pad2(day)}T12:00:00+09:00`);
}

async function purgeByTag(tag: string): Promise<number> {
  const deleted = await prisma.inquiry.deleteMany({
    where: { memo: { contains: tag } },
  });
  return deleted.count;
}

async function seed(year: number, count: number) {
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

  const tag = tagForYear(year);
  const removed = await purgeByTag(tag);
  if (removed > 0) {
    console.log(`기존 시드 삭제: ${removed}건 (${tag})`);
  }

  for (let i = 0; i < count; i++) {
    const preferredDate = randomPreferredDate(year);
    const teamLeader = randomItem(leaders);
    const name = `${randomItem(FAMILY)}${randomItem(GIVEN)}`;
    const phone = `010-${randomInt(8000, 9999)}-${randomInt(1000, 9999)}`;

    await prisma.$transaction(async (tx) => {
      const inquiry = await tx.inquiry.create({
        data: {
          customerName: name,
          customerPhone: phone,
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

  console.log(
    `OK: ${count}건 삽입 (${year}년 3·4·5월 랜덤, 태그 ${tag}, 팀장 ${leaders.length}명 중 랜덤 배정)`,
  );
}

async function main() {
  const purgeOnly = process.argv.includes('--purge');
  const year = Number(process.env.SEED_YEAR) || new Date().getFullYear();
  const count = Math.max(1, Number(process.env.SEED_COUNT) || DEFAULT_COUNT);
  const tag = tagForYear(year);

  if (purgeOnly) {
    const n = await purgeByTag(tag);
    console.log(`삭제 완료: ${n}건 (memo에 "${tag}" 포함)`);
    return;
  }

  await seed(year, count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
