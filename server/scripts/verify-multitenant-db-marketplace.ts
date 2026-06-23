/**
 * DB 마켓(정보공유) 검증 — 마스킹·금액·API 격리
 * 실행: cd server && npm run verify:multitenant:db-marketplace
 */
import 'dotenv/config';
import {
  maskMarketplaceCustomerName,
  maskMarketplaceAddressRegion,
} from '../src/lib/marketplaceListingMask.js';
import { computeMarketplaceDisplayAmount } from '../src/lib/dbMarketplaceAmount.js';

const API = process.env.VERIFY_API_BASE ?? 'http://127.0.0.1:3000/api';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

function verifyMaskAndAmount(): void {
  assert(maskMarketplaceCustomerName('홍길') === '홍0', '2-char name mask');
  assert(maskMarketplaceCustomerName('홍길동') === '홍0동', '3-char name mask');
  assert(maskMarketplaceCustomerName('김철수') === '김0수', '3-char name mask 2');

  const region = maskMarketplaceAddressRegion('서울특별시 강남구 역삼동 123');
  assert(region.includes('서울') && region.includes('강남'), `address region mask: ${region}`);
  assert(!region.includes('역삼'), 'dong hidden in region mask');

  assert(computeMarketplaceDisplayAmount(500_000, 50_000) === 450_000, 'display amount');
  assert(computeMarketplaceDisplayAmount(null, 10_000) === null, 'null balance');
  assert(computeMarketplaceDisplayAmount(5_000, 10_000) === null, 'negative display blocked');

  console.log('✓ mask & display amount helpers');
}

async function verifyTeamApiGate(): Promise<void> {
  let health: Response;
  try {
    health = await fetch(`${API}/health`);
  } catch {
    console.log('⊘ API 미기동 — 단위 검증만 완료');
    return;
  }
  if (!health.ok) {
    console.log('⊘ API 헬스 실패 — 단위 검증만 완료');
    return;
  }

  const res = await fetch(`${API}/team/db-marketplace`, {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  assert(res.status === 401 || res.status === 403, `team marketplace requires auth (${res.status})`);
  console.log('✓ team marketplace API auth gate');
}

async function main(): Promise<void> {
  verifyMaskAndAmount();
  await verifyTeamApiGate();
  console.log('verify:multitenant:db-marketplace OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
