import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedProfessionalDefaults } from '../src/modules/orderform/defaultProfessionalOptions.js';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('1234', 10);

  // 관리자 (항상 생성/업데이트)
  const admin = await prisma.user.upsert({
    where: { email: 'admin' },
    update: { passwordHash: hash, isActive: true },
    create: {
      email: 'admin',
      passwordHash: hash,
      name: '관리자',
      role: 'ADMIN',
    },
  });
  console.log('Admin:', admin.email);

  // 샘플 팀장 8명 (upsert — 로컬 테스트용)
  const teamLeaders = [
    { email: 'team1@skcleanteck.com', name: '김팀장', phone: '010-1111-2222' },
    { email: 'team2@skcleanteck.com', name: '이팀장', phone: '010-3333-4444' },
    { email: 'team3@skcleanteck.com', name: '박팀장', phone: '010-5555-1111' },
    { email: 'team4@skcleanteck.com', name: '최팀장', phone: '010-5555-2222' },
    { email: 'team5@skcleanteck.com', name: '정팀장', phone: '010-5555-3333' },
    { email: 'team6@skcleanteck.com', name: '강팀장', phone: '010-5555-4444' },
    { email: 'team7@skcleanteck.com', name: '조팀장', phone: '010-5555-5555' },
    { email: 'team8@skcleanteck.com', name: '윤팀장', phone: '010-5555-7777' },
  ];
  for (const t of teamLeaders) {
    const created = await prisma.user.upsert({
      where: { email: t.email },
      update: { name: t.name, phone: t.phone, isActive: true, role: 'TEAM_LEADER' },
      create: {
        email: t.email,
        passwordHash: hash,
        name: t.name,
        phone: t.phone,
        role: 'TEAM_LEADER',
      },
    });
    console.log('Team leader:', created.email);
  }

  // 팀 미배정 현장 팀원 14명 (teamId null — 팀원 관리 화면용)
  try {
    for (let i = 1; i <= 14; i++) {
      const name = `현장팀원${String(i).padStart(2, '0')}`;
      const existing = await prisma.teamMember.findFirst({
        where: { teamId: null, name },
      });
      if (existing) continue;
      await prisma.teamMember.create({
        data: {
          teamId: null,
          name,
          phone: `010-${String(8000 + i).padStart(4, '0')}-${String(7000 + i).padStart(4, '0')}`,
          sortOrder: i - 1,
          isActive: true,
        },
      });
    }
    const poolCount = await prisma.teamMember.count({ where: { teamId: null, isActive: true } });
    console.log(`TeamMember pool: ensured 14 names (active pool total: ${poolCount})`);
  } catch (e) {
    console.log('TeamMember pool: skip', e instanceof Error ? e.message : e);
  }

  // 샘플 마케터 (없을 때만 생성)
  const marketers = [{ email: 'marketer@skcleanteck.com', name: '홍마케터', phone: '010-5555-6666' }];
  for (const m of marketers) {
    const created = await prisma.user.upsert({
      where: { email: m.email },
      update: {},
      create: {
        email: m.email,
        passwordHash: hash,
        name: m.name,
        phone: m.phone,
        role: 'MARKETER',
      },
    });
    console.log('Marketer:', created.email);
  }

  // 대기(PENDING) 샘플 접수 4건 — 발주서 미제출 선접수 테스트용 (고정 ID로 시드 재실행 시 갱신만)
  try {
    const marketer = await prisma.user.findFirst({ where: { role: 'MARKETER' } });
    const createdById = marketer?.id ?? admin.id;
    const pendingSamples: Array<{
      id: string;
      customerName: string;
      customerPhone: string;
      address: string;
      addressDetail: string | null;
      areaPyeong: number;
      propertyType: string;
      roomCount: number;
      bathroomCount: number;
      memo: string;
    }> = [
      {
        id: 'f1e2d3c4-b5a6-4789-a012-3456789abcde',
        customerName: '오지훈',
        customerPhone: '010-2847-5519',
        address: '서울 송파구 올림픽로 300',
        addressDetail: '래미안 12동 803호',
        areaPyeong: 32,
        propertyType: '아파트',
        roomCount: 3,
        bathroomCount: 2,
        memo: '통화만 완료 · 발주서 대기(시드)',
      },
      {
        id: 'e2d3c4b5-a678-4901-b234-56789abcdef0',
        customerName: '한서연',
        customerPhone: '010-9136-2284',
        address: '경기 성남시 분당구 판교역로 146',
        addressDetail: '힐스테이트 B동 1502',
        areaPyeong: 28,
        propertyType: '아파트',
        roomCount: 3,
        bathroomCount: 2,
        memo: '입주일 미정 · 대기(시드)',
      },
      {
        id: 'd3c4b5a6-7890-4123-c456-789abcdef012',
        customerName: '윤도현',
        customerPhone: '010-6672-9041',
        address: '인천 연수구 컨벤시아대로 204',
        addressDetail: '오피스텔 7층',
        areaPyeong: 19,
        propertyType: '오피스텔',
        roomCount: 2,
        bathroomCount: 1,
        memo: '견적 문자 발송 예정(시드)',
      },
      {
        id: 'c4b5a678-9012-4234-d567-89abcdef0123',
        customerName: '임채원',
        customerPhone: '010-4408-7752',
        address: '서울 마포구 월드컵북로 396',
        addressDetail: '빌라 2층',
        areaPyeong: 22,
        propertyType: '빌라(연립)',
        roomCount: 2,
        bathroomCount: 1,
        memo: '고객 발주서 링크 대기(시드)',
      },
    ];
    for (const s of pendingSamples) {
      await prisma.inquiry.upsert({
        where: { id: s.id },
        update: {
          customerName: s.customerName,
          customerPhone: s.customerPhone,
          address: s.address,
          addressDetail: s.addressDetail,
          areaPyeong: s.areaPyeong,
          propertyType: s.propertyType,
          roomCount: s.roomCount,
          bathroomCount: s.bathroomCount,
          memo: s.memo,
          status: 'PENDING',
          createdById,
          orderFormId: null,
        },
        create: {
          id: s.id,
          customerName: s.customerName,
          customerPhone: s.customerPhone,
          address: s.address,
          addressDetail: s.addressDetail,
          areaPyeong: s.areaPyeong,
          propertyType: s.propertyType,
          roomCount: s.roomCount,
          bathroomCount: s.bathroomCount,
          memo: s.memo,
          status: 'PENDING',
          source: '전화',
          createdById,
        },
      });
    }
    console.log('Inquiry: 4 PENDING sample rows ensured');
  } catch {
    console.log('Inquiry PENDING samples: skip (run db:push first or schema mismatch)');
  }

  // 폼 메시지 설정 (없으면 생성, 클린벨→SK클린텍 보정)
  try {
    const formConfig = await prisma.orderFormConfig.findFirst();
    if (!formConfig) {
      await prisma.orderFormConfig.create({
        data: {},
      });
      console.log('OrderFormConfig: created');
    } else if (formConfig.formTitle.includes('클린벨')) {
      await prisma.orderFormConfig.update({
        where: { id: formConfig.id },
        data: { formTitle: formConfig.formTitle.replace('클린벨', 'SK클린텍') },
      });
      console.log('OrderFormConfig: formTitle corrected to SK클린텍');
    }
  } catch {
    console.log('OrderFormConfig: skip (table may not exist yet, run db:push first)');
  }

  try {
    await seedProfessionalDefaults(prisma);
    console.log('ProfessionalSpecialtyOption: seeded (default 8)');
  } catch {
    console.log('ProfessionalSpecialtyOption: skip (run db:push first)');
  }

  try {
    const defaults = ['네이버', '인스타그램', '배너', '기타'];
    let order = 0;
    for (const name of defaults) {
      const existing = await prisma.adChannel.findFirst({ where: { name } });
      if (!existing) {
        await prisma.adChannel.create({ data: { name, sortOrder: order++ } });
      }
    }
    console.log('AdChannel: default channels ensured');
  } catch {
    console.log('AdChannel: skip (run db:push first)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
