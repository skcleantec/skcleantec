/**
 * 2026-04-16 스케줄·지도 UI 테스트용 접수 20건 (서울·경기·인천 실제 도로명 주소).
 * memo에 고정 태그를 포함해 일괄 삭제합니다.
 */
import type { PrismaClient } from '@prisma/client';
import { allocateNextInquiryNumber } from '../src/modules/inquiries/inquiryNumber.js';

/** purge 시 memo contains 로 검색 */
export const MAP_TEST_20260416_TAG = '[SEED:지도스케줄테스트:20260416]';

/** 서울·경기·인천 실제 도로명·번지(카카오/지도 검색에 잘 잡히는 형식) */
const ADDRESSES_20 = [
  '서울특별시 종로구 세종대로 175',
  '서울특별시 중구 세종대로 110',
  '서울특별시 강남구 테헤란로 427',
  '서울특별시 송파구 올림픽로 300',
  '서울특별시 마포구 월드컵북로 396',
  '서울특별시 영등포구 여의대로 108',
  '서울특별시 용산구 한강대로 23',
  '경기도 수원시 영통구 광교로 145',
  '경기도 성남시 분당구 판교역로 146',
  '경기도 고양시 일산동구 정발산로 21',
  '경기도 용인시 기흥구 용구대로 2469',
  '경기도 부천시 원미구 길주로 180',
  '경기도 안양시 동안구 시민대로 180',
  '경기도 하남시 미사대로 750',
  '경기도 의정부시 평화로 525',
  '인천광역시 중구 월미로 70',
  '인천광역시 연수구 컨벤시아대로 165',
  '인천광역시 부평구 부평대로 283',
  '인천광역시 남동구 인주대로 585',
  '인천광역시 서구 봉수대로 806',
] as const;

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
}

export async function purgeMapTest20260416(prisma: PrismaClient): Promise<number> {
  const r = await prisma.inquiry.deleteMany({
    where: { memo: { contains: MAP_TEST_20260416_TAG } },
  });
  return r.count;
}

export async function seedMapTest20260416(prisma: PrismaClient): Promise<void> {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    throw new Error('관리자 계정이 없습니다. npm run db:seed 를 먼저 실행하세요.');
  }

  const removed = await purgeMapTest20260416(prisma);
  if (removed > 0) {
    console.log(`기존 동일 태그 시드 삭제: ${removed}건`);
  }

  const preferredDate = new Date('2026-04-16T12:00:00+09:00');
  const addresses = [...ADDRESSES_20];
  shuffleInPlace(addresses);

  const times = ['오전', '오후', '사이청소'] as const;

  for (let i = 0; i < 20; i++) {
    await prisma.$transaction(async (tx) => {
      const inquiryNumber = await allocateNextInquiryNumber(tx);
      await tx.inquiry.create({
        data: {
          inquiryNumber,
          customerName: `맵테스트${String(i + 1).padStart(2, '0')}`,
          customerPhone: `010-9${String(100 + i).padStart(3, '0')}-${String(2000 + i).padStart(4, '0')}`,
          createdById: admin.id,
          address: addresses[i]!,
          addressDetail: `${(i % 9) + 1}동 ${1400 + i}호`,
          areaPyeong: 24 + (i % 15),
          propertyType: '아파트',
          roomCount: 3,
          bathroomCount: 2,
          balconyCount: 1,
          preferredDate,
          preferredTime: times[i % 3]!,
          status: 'RECEIVED',
          memo: `${MAP_TEST_20260416_TAG}\n지도·스케줄 UI 테스트(서울·경기·인천 도로명). 일괄삭제: 루트에서 npm run db:purge:map:test-20260416`,
          source: '시드',
        },
      });
    });
  }

  console.log('삽입 완료: 20건, 예약일 2026-04-16 (KST), 주소 랜덤 순서');
}
