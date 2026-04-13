/**
 * 상세 필드가 채워진 접수 3건 삽입 (고정 ID — 재실행 시 동일 3건 갱신)
 * 실행: cd server && npx tsx scripts/seed-three-detailed-inquiries.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { allocateNextInquiryNumber } from '../src/modules/inquiries/inquiryNumber.js';

const prisma = new PrismaClient();

const INQUIRY_IDS = [
  'd0e0f0a0-b1c2-4333-d444-555566660001',
  'd0e0f0a0-b1c2-4333-d444-555566660002',
  'd0e0f0a0-b1c2-4333-d444-555566660003',
] as const;

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  const leader1 = await prisma.user.findFirst({
    where: { email: 'team1@skcleanteck.com', isActive: true },
  });
  const leader2 = await prisma.user.findFirst({
    where: { email: 'team2@skcleanteck.com', isActive: true },
  });
  if (!admin) throw new Error('ADMIN 계정이 없습니다. npm run db:seed 를 먼저 실행하세요.');
  if (!leader1 || !leader2) throw new Error('팀장(team1/team2) 계정이 없습니다. npm run db:seed 를 먼저 실행하세요.');

  for (const id of INQUIRY_IDS) {
    await prisma.assignment.deleteMany({ where: { inquiryId: id } });
    await prisma.inquiry.deleteMany({ where: { id } });
  }

  const samples = [
    {
      id: INQUIRY_IDS[0],
      teamLeaderId: leader1.id,
      customerName: '강민준',
      customerPhone: '010-4821-9033',
      customerPhone2: '010-3390-1122',
      address: '서울 강남구 테헤란로 152',
      addressDetail: '강남파이낸스센터 인근 아파트 105동 3201호',
      areaPyeong: 42,
      areaBasis: '전용',
      propertyType: '아파트',
      roomCount: 4,
      bathroomCount: 2,
      balconyCount: 2,
      kitchenCount: 2,
      buildingType: '아파트(32평형)',
      preferredDate: new Date('2026-04-24T12:00:00+09:00'),
      preferredTime: '오후',
      betweenScheduleSlot: null as string | null,
      preferredTimeDetail: '13시 전후 도착 희망',
      callAttempt: 3,
      memo: '관리사무소 열쇠 수령 완료. 주차 B2 지정구역.',
      scheduleMemo: '에어컨 분해 없이 표준 / 현관 카드키 사전 전달',
      specialNotes:
        '신축 2년차 · 새집증후군 케어 문의함. 거실 대리석, 안방 강마루. 애완동물 없음. 입주 청소 후 곰팡이 냄새 민감.',
      moveInDate: new Date('2026-04-26T12:00:00+09:00'),
      serviceTotalAmount: 980_000,
      serviceDepositAmount: 200_000,
      serviceBalanceAmount: 780_000,
      crewMemberCount: 4,
      crewMemberNote: '김·이·박·최 (다팀 협의)',
      professionalOptionIds: ['newhouse_syndrome', 'window_work', 'deodorize_sanitize'] as unknown as object,
      status: 'ASSIGNED' as const,
      source: '전화',
      externalTransferFee: null as number | null,
    },
    {
      id: INQUIRY_IDS[1],
      teamLeaderId: leader2.id,
      customerName: '서지아',
      customerPhone: '010-7712-4488',
      customerPhone2: null,
      address: '경기 용인시 수지구 포은대로 520',
      addressDetail: '단독주택 (2층+옥탑) — 현관 비밀번호 사전 문자',
      areaPyeong: 55,
      areaBasis: '공급',
      propertyType: '빌라(연립)',
      roomCount: 5,
      bathroomCount: 3,
      balconyCount: 1,
      kitchenCount: 1,
      buildingType: '단독/다가구',
      preferredDate: new Date('2026-04-28T12:00:00+09:00'),
      preferredTime: '오전',
      betweenScheduleSlot: null,
      preferredTimeDetail: '8시 30분 경 도착',
      callAttempt: 2,
      memo: '대문 개폐 시 소음 주의 요청. 마당 호스 연결 가능.',
      scheduleMemo: '2층 창틀 곰팡이 의심 구간 집중',
      specialNotes:
        '전 세입자 흡연 이력 있음. 천장 코너·욕실 실리콘 전체 교체 희망(별도 협의). 인터넷 설치 4/29 예정.',
      moveInDate: new Date('2026-05-01T12:00:00+09:00'),
      serviceTotalAmount: 1_250_000,
      serviceDepositAmount: 250_000,
      serviceBalanceAmount: 1_000_000,
      crewMemberCount: 5,
      crewMemberNote: '사다리차 불가 — 사다리 지참',
      professionalOptionIds: ['pest_control', 'floor_sanding', 'culb_construction'] as unknown as object,
      status: 'IN_PROGRESS' as const,
      source: '네이버',
      externalTransferFee: 150_000,
    },
    {
      id: INQUIRY_IDS[2],
      teamLeaderId: leader1.id,
      customerName: '박도윤',
      customerPhone: '010-2299-6610',
      customerPhone2: '02-3445-7788',
      address: '서울 마포구 양화로 45',
      addressDetail: '오피스텔 18층 1807호 (엘리베이터 정상)',
      areaPyeong: 21,
      areaBasis: '전용',
      propertyType: '오피스텔',
      roomCount: 1,
      bathroomCount: 1,
      balconyCount: 0,
      kitchenCount: 1,
      buildingType: '오피스텔',
      preferredDate: new Date('2026-05-03T12:00:00+09:00'),
      preferredTime: '사이청소',
      betweenScheduleSlot: '오후' as const,
      preferredTimeDetail: '전 입주자 퇴실 11시 / 신규 입주 15시',
      callAttempt: 4,
      memo: '집주인 중개사 통해 연락. 열쇠함 번호 문자로 재전송 예정.',
      scheduleMemo: '사이청소 · 오후 확정 / 붙박이장 내부만 제외',
      specialNotes:
        '복층 구조 아님. 시스템 에어컨 2대(거실·침실). 붙박이장은 외부만 닦기. 층간소음 민원 있어 망치 작업 자제.',
      moveInDate: new Date('2026-05-03T12:00:00+09:00'),
      serviceTotalAmount: 520_000,
      serviceDepositAmount: 100_000,
      serviceBalanceAmount: 420_000,
      crewMemberCount: 2,
      crewMemberNote: '2인 1조',
      professionalOptionIds: ['appliance_no_disassembly', 'mattress_fabric'] as unknown as object,
      status: 'RECEIVED' as const,
      source: '인스타그램',
      externalTransferFee: null,
    },
  ];

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i]!;
      const inquiryNumber = await allocateNextInquiryNumber(tx);
      await tx.inquiry.create({
        data: {
          id: s.id,
          inquiryNumber,
          customerName: s.customerName,
          customerPhone: s.customerPhone,
          customerPhone2: s.customerPhone2,
          address: s.address,
          addressDetail: s.addressDetail,
          areaPyeong: s.areaPyeong,
          areaBasis: s.areaBasis,
          propertyType: s.propertyType,
          roomCount: s.roomCount,
          bathroomCount: s.bathroomCount,
          balconyCount: s.balconyCount,
          kitchenCount: s.kitchenCount,
          buildingType: s.buildingType,
          preferredDate: s.preferredDate,
          preferredTime: s.preferredTime,
          betweenScheduleSlot: s.betweenScheduleSlot,
          preferredTimeDetail: s.preferredTimeDetail,
          callAttempt: s.callAttempt,
          memo: s.memo,
          scheduleMemo: s.scheduleMemo,
          specialNotes: s.specialNotes,
          moveInDate: s.moveInDate,
          serviceTotalAmount: s.serviceTotalAmount,
          serviceDepositAmount: s.serviceDepositAmount,
          serviceBalanceAmount: s.serviceBalanceAmount,
          crewMemberCount: s.crewMemberCount,
          crewMemberNote: s.crewMemberNote,
          professionalOptionIds: s.professionalOptionIds,
          status: s.status,
          source: s.source,
          externalTransferFee: s.externalTransferFee,
          createdById: admin.id,
        },
      });
      await tx.assignment.create({
        data: {
          inquiryId: s.id,
          teamLeaderId: s.teamLeaderId,
          assignedById: admin.id,
          sortOrder: 0,
        },
      });
      console.log(`접수 생성: ${inquiryNumber} · ${s.customerName} · ${s.status}`);
    }
  });

  console.log('완료: 상세 접수 3건 (고정 ID, 재실행 시 동일 건 교체)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
