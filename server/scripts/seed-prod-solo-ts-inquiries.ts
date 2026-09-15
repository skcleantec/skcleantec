/**
 * 운영 ts 테넌트 — 길안내·전화 모바일 테스트용 접수
 *
 *   cd server
 *   npx tsx scripts/seed-prod-solo-ts-inquiries.ts
 */
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { allocateNextInquiryNumber } from '../src/modules/inquiries/inquiryNumber.js';
import { inquiryGeocodeQueryLine } from '../src/modules/inquiries/inquiryAddressGeoSync.js';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const SLUG = 'ts';
const SEED_TAG = '[solo-navi-seed]';

type SeedJob = {
  customerName: string;
  phone: string;
  address: string;
  addressDetail: string;
  lat: number;
  lng: number;
  dayOffset: number;
  preferredTime: string;
  pyeong: number;
  total: number;
  deposit: number;
};

/** 실제 도로명 + 공개 좌표 — TMAP이 바로 열리게 캐시까지 넣음 */
const JOBS: SeedJob[] = [
  {
    customerName: '강남테스트',
    phone: '010-2000-0001',
    address: '서울특별시 강남구 강남대로 396',
    addressDetail: '강남역 11번 출구 인근 테스트',
    lat: 37.4979,
    lng: 127.0276,
    dayOffset: 0,
    preferredTime: '오전',
    pyeong: 24,
    total: 280000,
    deposit: 50000,
  },
  {
    customerName: '광화문테스트',
    phone: '010-2000-0002',
    address: '서울특별시 종로구 세종대로 172',
    addressDetail: '광화문 광장 인근 테스트',
    lat: 37.5716,
    lng: 126.9769,
    dayOffset: 0,
    preferredTime: '오후',
    pyeong: 32,
    total: 350000,
    deposit: 50000,
  },
  {
    customerName: '잠실테스트',
    phone: '010-2000-0003',
    address: '서울특별시 송파구 올림픽로 300',
    addressDetail: '롯데월드타워 인근 테스트',
    lat: 37.5126,
    lng: 127.1025,
    dayOffset: 1,
    preferredTime: '오전',
    pyeong: 48,
    total: 520000,
    deposit: 100000,
  },
  {
    customerName: '여의도테스트',
    phone: '010-2000-0004',
    address: '서울특별시 영등포구 국제금융로 10',
    addressDetail: 'IFC 인근 테스트',
    lat: 37.525,
    lng: 126.9256,
    dayOffset: 1,
    preferredTime: '오후',
    pyeong: 28,
    total: 310000,
    deposit: 50000,
  },
  {
    customerName: '홍대테스트',
    phone: '010-2000-0005',
    address: '서울특별시 마포구 양화로 188',
    addressDetail: '홍대입구역 인근 테스트',
    lat: 37.5563,
    lng: 126.922,
    dayOffset: 2,
    preferredTime: '오전',
    pyeong: 18,
    total: 220000,
    deposit: 30000,
  },
];

function requireProdUrl(): string {
  const url = (
    process.env.SOLO_SEED_DATABASE_URL ??
    process.env.SKCT_TARGET_DATABASE_URL ??
    process.env.SKCT_SOURCE_DATABASE_URL ??
    ''
  ).trim();
  if (!url) throw new Error('운영 DB URL이 없습니다.');
  const host = new URL(url.replace(/^postgresql:/, 'http:')).hostname;
  if (!host.includes('proxy.rlwy.net')) {
    throw new Error(`운영 Proxy 호스트가 아닙니다: ${host}`);
  }
  console.info(`[db] host=${host}`);
  return url;
}

function kstYmdAddDays(offset: number): string {
  const now = new Date();
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  kst.setDate(kst.getDate() + offset);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, '0');
  const d = String(kst.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const prisma = new PrismaClient({ datasources: { db: { url: requireProdUrl() } } });

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: SLUG },
    select: { id: true, name: true, plan: true },
  });
  if (!tenant) throw new Error(`업체 ${SLUG} 가 없습니다. 먼저 테넌트를 만드세요.`);

  const oc = await prisma.operatingCompany.findFirst({
    where: { tenantId: tenant.id, isDefault: true },
    select: { id: true },
  });
  if (!oc) throw new Error('기본 영업 브랜드가 없습니다.');

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'admin', role: 'ADMIN' },
    select: { id: true },
  });

  let created = 0;
  let skipped = 0;

  for (const job of JOBS) {
    const existing = await prisma.inquiry.findFirst({
      where: {
        tenantId: tenant.id,
        customerPhone: job.phone,
        memo: { contains: SEED_TAG },
        deletedAt: null,
      },
      select: { id: true, inquiryNumber: true },
    });
    if (existing) {
      skipped += 1;
      console.info(`[skip] ${job.customerName} ${existing.inquiryNumber ?? existing.id}`);
      continue;
    }

    const ymd = kstYmdAddDays(job.dayOffset);
    const preferredDate = new Date(`${ymd}T12:00:00+09:00`);
    const geoQuery = inquiryGeocodeQueryLine(job.address, job.addressDetail);
    const inquiryNumber = await allocateNextInquiryNumber(prisma, tenant.id, oc.id);

    const row = await prisma.inquiry.create({
      data: {
        tenantId: tenant.id,
        operatingCompanyId: oc.id,
        inquiryNumber,
        customerName: job.customerName,
        customerPhone: job.phone,
        address: job.address,
        addressDetail: job.addressDetail,
        addressGeoQuery: geoQuery,
        addressGeoLat: job.lat,
        addressGeoLng: job.lng,
        areaPyeong: job.pyeong,
        propertyType: '아파트',
        buildingType: '아파트',
        preferredDate,
        preferredTime: job.preferredTime,
        status: 'RECEIVED',
        source: '전화',
        intakeChannel: 'phone',
        memo: `${SEED_TAG} 모바일 길안내·전화 테스트`,
        specialNotes: '테스트 접수입니다. 길안내·전화 버튼 확인용.',
        scheduleMemo: '네비테스트',
        serviceTotalAmount: job.total,
        serviceDepositAmount: job.deposit,
        serviceBalanceAmount: job.total - job.deposit,
        createdById: admin?.id ?? null,
      },
      select: { id: true, inquiryNumber: true, customerName: true },
    });
    created += 1;
    console.info(`[create] ${row.inquiryNumber} ${row.customerName} ${ymd} ${job.preferredTime}`);
  }

  const total = await prisma.inquiry.count({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  console.info(`[ok] created=${created} skipped=${skipped} tenantInquiries=${total}`);
  console.info('로그인 후 서비스접수·스케줄에서 접수를 열고 「길안내」를 누르세요.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
