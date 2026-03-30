import 'dotenv/config';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { formatProfessionalOptionsMemoLine } from '../src/modules/orderform/specialtyOptions.js';

const prisma = new PrismaClient();

/** 재실행 시 동일 토큰 데이터 교체 */
const SAMPLE_TOKENS = [
  'seed_orderform_sample_01',
  'seed_orderform_sample_02',
  'seed_orderform_sample_03',
  'seed_orderform_sample_04',
  'seed_orderform_sample_05',
  'seed_orderform_sample_06',
  'seed_orderform_sample_07',
  'seed_orderform_sample_08',
  'seed_orderform_sample_09',
  'seed_orderform_sample_10',
] as const;

type SampleRow = {
  token: (typeof SAMPLE_TOKENS)[number];
  customerName: string;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  optionNote: string | null;
  preferredDate: string;
  preferredTime: string;
  preferredTimeDetail: string | null;
  customerPhone: string;
  customerPhone2: string;
  address: string;
  addressDetail: string | null;
  areaPyeong: number;
  areaBasis: '공급' | '전용';
  propertyType: string;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  kitchenCount: number | null;
  buildingType: string;
  moveInDate: string | null;
  specialNotes: string | null;
  professionalIds: string[];
  submittedDaysAgo: number;
};

const SAMPLES: SampleRow[] = [
  {
    token: 'seed_orderform_sample_01',
    customerName: '김민준',
    totalAmount: 580000,
    depositAmount: 20000,
    balanceAmount: 560000,
    optionNote: '발코니 유리 얼룩 제거 요청',
    preferredDate: '2026-04-12',
    preferredTime: '오전',
    preferredTimeDetail: '09:00~11:00',
    customerPhone: '010-2345-6789',
    customerPhone2: '010-9876-5432',
    address: '서울특별시 강남구 테헤란로 123',
    addressDetail: '래미안102동 3204호',
    areaPyeong: 32,
    areaBasis: '전용',
    propertyType: '아파트',
    roomCount: 3,
    bathroomCount: 2,
    balconyCount: 1,
    kitchenCount: 1,
    buildingType: '신축',
    moveInDate: '2026-04-10',
    specialNotes: '엘리베이터 앞 대형 가구 입고 예정',
    professionalIds: ['newhouse_syndrome', 'window_work'],
    submittedDaysAgo: 2,
  },
  {
    token: 'seed_orderform_sample_02',
    customerName: '이서연',
    totalAmount: 420000,
    depositAmount: 20000,
    balanceAmount: 400000,
    optionNote: null,
    preferredDate: '2026-04-15',
    preferredTime: '오후',
    preferredTimeDetail: null,
    customerPhone: '010-3456-7890',
    customerPhone2: '010-8765-4321',
    address: '서울특별시 송파구 올림픽로 45',
    addressDetail: '트리마제 15층',
    areaPyeong: 21,
    areaBasis: '전용',
    propertyType: '오피스텔',
    roomCount: 1,
    bathroomCount: 1,
    balconyCount: 0,
    kitchenCount: 1,
    buildingType: '인테리어 후',
    moveInDate: null,
    specialNotes: null,
    professionalIds: ['deodorize_sanitize'],
    submittedDaysAgo: 3,
  },
  {
    token: 'seed_orderform_sample_03',
    customerName: '박도윤',
    totalAmount: 720000,
    depositAmount: 30000,
    balanceAmount: 690000,
    optionNote: '현관 중문 주변 실리콘 정리',
    preferredDate: '2026-04-18',
    preferredTime: '사이청소',
    preferredTimeDetail: '13:00 전후',
    customerPhone: '010-4567-8901',
    customerPhone2: '010-7654-3210',
    address: '서울특별시 마포구 월드컵북로 400',
    addressDetail: '푸르지오 109동 1801호',
    areaPyeong: 45,
    areaBasis: '공급',
    propertyType: '아파트',
    roomCount: 4,
    bathroomCount: 2,
    balconyCount: 2,
    kitchenCount: 1,
    buildingType: '구축',
    moveInDate: '2026-04-17',
    specialNotes: '반려견 털 많음',
    professionalIds: ['pest_control', 'mattress_fabric'],
    submittedDaysAgo: 1,
  },
  {
    token: 'seed_orderform_sample_04',
    customerName: '최하은',
    totalAmount: 380000,
    depositAmount: 20000,
    balanceAmount: 360000,
    optionNote: null,
    preferredDate: '2026-04-20',
    preferredTime: '오전',
    preferredTimeDetail: null,
    customerPhone: '010-5678-9012',
    customerPhone2: '010-6543-2109',
    address: '서울특별시 성북구 보문로 100',
    addressDetail: '소형 빌라 3층',
    areaPyeong: 18,
    areaBasis: '전용',
    propertyType: '빌라',
    roomCount: 2,
    bathroomCount: 1,
    balconyCount: 1,
    kitchenCount: 1,
    buildingType: '거주 중',
    moveInDate: null,
    specialNotes: '주차 협소, 사전 연락 필수',
    professionalIds: [],
    submittedDaysAgo: 5,
  },
  {
    token: 'seed_orderform_sample_05',
    customerName: '정시우',
    totalAmount: 890000,
    depositAmount: 40000,
    balanceAmount: 850000,
    optionNote: '발코니·거실 바닥 마루 상태 확인 요청',
    preferredDate: '2026-04-22',
    preferredTime: '오후',
    preferredTimeDetail: '14:00~17:00',
    customerPhone: '010-6789-0123',
    customerPhone2: '010-5432-1098',
    address: '경기도 성남시 분당구 판교역로 146',
    addressDetail: '힐스테이트 204동',
    areaPyeong: 59,
    areaBasis: '전용',
    propertyType: '아파트',
    roomCount: 4,
    bathroomCount: 3,
    balconyCount: 2,
    kitchenCount: 1,
    buildingType: '신축',
    moveInDate: '2026-04-21',
    specialNotes: null,
    professionalIds: ['floor_sanding', 'culb_construction'],
    submittedDaysAgo: 0,
  },
  {
    token: 'seed_orderform_sample_06',
    customerName: '강유진',
    totalAmount: 510000,
    depositAmount: 20000,
    balanceAmount: 490000,
    optionNote: null,
    preferredDate: '2026-04-25',
    preferredTime: '오전',
    preferredTimeDetail: null,
    customerPhone: '010-7890-1234',
    customerPhone2: '010-4321-0987',
    address: '경기도 고양시 일산동구 중앙로 1200',
    addressDetail: '아이파크 305동',
    areaPyeong: 33,
    areaBasis: '전용',
    propertyType: '아파트',
    roomCount: 3,
    bathroomCount: 2,
    balconyCount: 1,
    kitchenCount: 1,
    buildingType: '인테리어 후',
    moveInDate: '2026-04-24',
    specialNotes: '새집증후군 케어 상담 희망',
    professionalIds: ['newhouse_syndrome'],
    submittedDaysAgo: 4,
  },
  {
    token: 'seed_orderform_sample_07',
    customerName: '윤지호',
    totalAmount: 460000,
    depositAmount: 20000,
    balanceAmount: 440000,
    optionNote: '외창 레일 먼지 심함',
    preferredDate: '2026-04-28',
    preferredTime: '사이청소',
    preferredTimeDetail: null,
    customerPhone: '010-8901-2345',
    customerPhone2: '010-3210-9876',
    address: '경기도 화성시 동탄대로 150',
    addressDetail: '동탄역 롯데캐슬 708호',
    areaPyeong: 26,
    areaBasis: '전용',
    propertyType: '아파트',
    roomCount: 3,
    bathroomCount: 2,
    balconyCount: 1,
    kitchenCount: 1,
    buildingType: '신축',
    moveInDate: '2026-04-27',
    specialNotes: null,
    professionalIds: ['window_work', 'appliance_no_disassembly'],
    submittedDaysAgo: 6,
  },
  {
    token: 'seed_orderform_sample_08',
    customerName: '한예준',
    totalAmount: 640000,
    depositAmount: 25000,
    balanceAmount: 615000,
    optionNote: '주방 상판 코킹 부분 재시공 예정',
    preferredDate: '2026-05-02',
    preferredTime: '오후',
    preferredTimeDetail: '15:00 이후',
    customerPhone: '010-9012-3456',
    customerPhone2: '010-2109-8765',
    address: '경기도 수원시 영통구 광교중앙로 100',
    addressDetail: '자이 12단지 805호',
    areaPyeong: 41,
    areaBasis: '공급',
    propertyType: '아파트',
    roomCount: 3,
    bathroomCount: 2,
    balconyCount: 1,
    kitchenCount: 1,
    buildingType: '구축',
    moveInDate: null,
    specialNotes: '입주 전 사진 촬영 동의',
    professionalIds: ['pest_control'],
    submittedDaysAgo: 7,
  },
  {
    token: 'seed_orderform_sample_09',
    customerName: '오채원',
    totalAmount: 395000,
    depositAmount: 20000,
    balanceAmount: 375000,
    optionNote: null,
    preferredDate: '2026-05-05',
    preferredTime: '오전',
    preferredTimeDetail: null,
    customerPhone: '010-0123-4567',
    customerPhone2: '010-1098-7654',
    address: '인천광역시 연수구 컨벤시아대로 50',
    addressDetail: '송도 더샵 1204호',
    areaPyeong: 28,
    areaBasis: '전용',
    propertyType: '아파트',
    roomCount: 3,
    bathroomCount: 2,
    balconyCount: 1,
    kitchenCount: 1,
    buildingType: '신축',
    moveInDate: '2026-05-04',
    specialNotes: null,
    professionalIds: ['deodorize_sanitize', 'mattress_fabric'],
    submittedDaysAgo: 8,
  },
  {
    token: 'seed_orderform_sample_10',
    customerName: '신우주',
    totalAmount: 550000,
    depositAmount: 20000,
    balanceAmount: 530000,
    optionNote: '욕실 타일 줄눈 곰팡이 집중',
    preferredDate: '2026-05-08',
    preferredTime: '오후',
    preferredTimeDetail: '12:00~15:00',
    customerPhone: '010-1234-5678',
    customerPhone2: '010-0987-6543',
    address: '대전광역시 유성구 대학로 82',
    addressDetail: 'e편한세상 502동',
    areaPyeong: 35,
    areaBasis: '전용',
    propertyType: '아파트',
    roomCount: 3,
    bathroomCount: 2,
    balconyCount: 1,
    kitchenCount: 1,
    buildingType: '거주 중',
    moveInDate: null,
    specialNotes: '아이 알레르기 있음 (강한 약품 자제)',
    professionalIds: ['pest_control', 'deodorize_sanitize'],
    submittedDaysAgo: 9,
  },
];

function buildMemo(
  form: {
    totalAmount: number;
    depositAmount: number;
    balanceAmount: number;
    optionNote: string | null;
  },
  body: {
    customerPhone2: string;
    propertyType: string;
    areaBasis: string;
    areaPyeong: number;
    buildingType: string;
    moveInDate: string | null;
    specialNotes: string | null;
    useDetailStr: string | null;
  },
  professionalMemoLine: string | null
): string {
  return [
    `[발주서] 총 ${form.totalAmount.toLocaleString('ko-KR')}원 (예약금 ${form.depositAmount.toLocaleString('ko-KR')}원, 잔금 ${form.balanceAmount.toLocaleString('ko-KR')}원)`,
    `보조 연락처: ${body.customerPhone2}`,
    `건축물 유형: ${body.propertyType}`,
    `평수: ${body.areaBasis} ${body.areaPyeong}평`,
    form.optionNote ? `추가: ${form.optionNote}` : null,
    `신축/구축/인테리어/거주: ${body.buildingType}`,
    body.moveInDate ? `이사 날짜: ${body.moveInDate}` : null,
    body.specialNotes ? `특이사항: ${body.specialNotes}` : null,
    body.useDetailStr ? `희망 시각: ${body.useDetailStr}` : null,
    professionalMemoLine,
  ]
    .filter(Boolean)
    .join('\n');
}

async function main() {
  const marketer =
    (await prisma.user.findUnique({ where: { email: 'marketer@skcleanteck.com' } })) ??
    (await prisma.user.findUnique({ where: { email: 'admin' } }));
  if (!marketer) {
    throw new Error('마케터 또는 관리자 계정이 없습니다. 먼저 npm run db:seed 를 실행하세요.');
  }

  await prisma.inquiry.deleteMany({
    where: { orderForm: { token: { in: [...SAMPLE_TOKENS] } } },
  });
  await prisma.orderForm.deleteMany({
    where: { token: { in: [...SAMPLE_TOKENS] } },
  });

  const now = Date.now();

  for (const row of SAMPLES) {
    const submittedAt = new Date(now - row.submittedDaysAgo * 24 * 60 * 60 * 1000);
    const preferredDate = new Date(row.preferredDate + 'T12:00:00');
    const moveInDate = row.moveInDate ? new Date(row.moveInDate + 'T12:00:00') : null;

    const useTimeStr = row.preferredTime;
    const useDetailStr = row.preferredTimeDetail?.trim() || null;

    const professionalMemoLine = await formatProfessionalOptionsMemoLine(prisma, row.professionalIds);

    const memo = buildMemo(
      {
        totalAmount: row.totalAmount,
        depositAmount: row.depositAmount,
        balanceAmount: row.balanceAmount,
        optionNote: row.optionNote,
      },
      {
        customerPhone2: row.customerPhone2,
        propertyType: row.propertyType,
        areaBasis: row.areaBasis,
        areaPyeong: row.areaPyeong,
        buildingType: row.buildingType,
        moveInDate: row.moveInDate,
        specialNotes: row.specialNotes,
        useDetailStr,
      },
      professionalMemoLine
    );

    await prisma.$transaction(async (tx) => {
      const form = await tx.orderForm.create({
        data: {
          token: row.token,
          customerName: row.customerName,
          totalAmount: row.totalAmount,
          depositAmount: row.depositAmount,
          balanceAmount: row.balanceAmount,
          optionNote: row.optionNote,
          preferredDate: row.preferredDate,
          preferredTime: row.preferredTime,
          preferredTimeDetail: row.preferredTimeDetail,
          createdById: marketer.id,
          submittedAt,
        },
      });

      await tx.inquiry.create({
        data: {
          createdById: marketer.id,
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          customerPhone2: row.customerPhone2,
          address: row.address,
          addressDetail: row.addressDetail,
          areaPyeong: row.areaPyeong,
          areaBasis: row.areaBasis,
          propertyType: row.propertyType,
          roomCount: row.roomCount,
          bathroomCount: row.bathroomCount,
          balconyCount: row.balconyCount,
          kitchenCount: row.kitchenCount,
          preferredDate,
          preferredTime: useTimeStr,
          preferredTimeDetail: useDetailStr,
          memo,
          buildingType: row.buildingType,
          moveInDate,
          specialNotes: row.specialNotes,
          serviceTotalAmount: row.totalAmount,
          serviceDepositAmount: row.depositAmount,
          serviceBalanceAmount: row.balanceAmount,
          source: '발주서',
          status: 'RECEIVED',
          orderFormId: form.id,
          professionalOptionIds: row.professionalIds.length ? row.professionalIds : undefined,
        },
      });
    });

    console.log(`발주서+접수 생성: ${row.customerName} (${row.token})`);
  }

  console.log('완료: 접수된 발주서 예시 10건을 DB에 반영했습니다.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
