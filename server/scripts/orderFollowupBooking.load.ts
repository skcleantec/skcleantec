/**
 * 가짜 15,000 부재·보류 × 5,000 접수.
 * 목록 한 페이지, sweep 전체, sweep 중 /api/health 지연을 잰다. DB 는 쓰지 않는다.
 */
import http from 'node:http';
import {
  buildInquiryBookingIndex,
  pickFollowupBookingNarrowed,
  sweepFollowupsYielding,
  type FollowupMatchInput,
  type InquiryMatchInput,
} from '../src/modules/order-followups/orderFollowupBooking.logic.js';

const INQUIRIES = 5000;
const FOLLOWUPS = 15000;
const PAGE = 50;

function inquiry(i: number): InquiryMatchInput {
  const phone = `010${String(10000000 + (i % 8000)).padStart(8, '0')}`;
  return {
    id: `inq-${i}`,
    inquiryNumber: null,
    status: i % 40 === 0 ? 'COMPLETED' : 'RECEIVED',
    operatingCompanyId: i % 9 === 0 ? 'brand-b' : 'brand-a',
    customerName: i % 5 === 0 ? '홍길동' : `고객${i % 700}`,
    nickname: null,
    customerPhone: phone,
    customerPhone2: null,
    address: `서울특별시 강남구 역삼동 래미안아파트 ${i % 40}동`,
    buildingType: '아파트',
    areaPyeong: 20 + (i % 6),
    roomCount: 3,
    bathroomCount: 2,
    isOneRoom: false,
    preferredDate: new Date(Date.UTC(2026, 10, 1 + (i % 27), 3)),
    createdAt: new Date(Date.UTC(2026, 10, 1, 1)),
    completedAt: i % 40 === 0 ? new Date(Date.UTC(2026, 9, 1, 1)) : null,
    source: '전화',
  };
}

function followup(i: number, inquiries: InquiryMatchInput[]): FollowupMatchInput {
  const hit = i % 25 === 0 ? inquiries[i % inquiries.length]! : null;
  return {
    operatingCompanyId: 'brand-a',
    customerName: hit ? hit.customerName : `부재${i}`,
    nickname: null,
    customerPhone: hit ? hit.customerPhone : `010${String(30000000 + (i % 12000)).padStart(8, '0')}`,
    customerPhone2: null,
    address: hit ? hit.address : `부산광역시 해운대구 우동 ${i}`,
    memo: '',
    areaPyeong: hit ? hit.areaPyeong : 33,
    roomCount: 3,
    bathroomCount: 2,
    isOneRoom: false,
    preferredMoveInCleaningDate: '2026-11-20',
    status: 'ABSENT',
    createdAt: new Date(Date.UTC(2026, 10, 20, 1)),
    leadSource: null,
    inquiryId: i % 80 === 0 ? inquiries[i % inquiries.length]!.id : null,
  };
}

async function main(): Promise<void> {
  const inquiries = Array.from({ length: INQUIRIES }, (_, i) => inquiry(i));
  const followups = Array.from({ length: FOLLOWUPS }, (_, i) => followup(i, inquiries));
  const page = followups.slice(0, PAGE);

  const indexStarted = performance.now();
  const index = buildInquiryBookingIndex(inquiries);
  const indexMs = Math.round(performance.now() - indexStarted);
  const listStarted = performance.now();
  for (const row of page) pickFollowupBookingNarrowed(row, index);
  const listMs = Math.round(performance.now() - listStarted);

  const healthMs: number[] = [];
  const server = http.createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  let polling = true;
  const poller = (async () => {
    while (polling) {
      const started = performance.now();
      await fetch(`http://127.0.0.1:${port}/api/health`);
      healthMs.push(performance.now() - started);
    }
  })();

  const sliceMs: number[] = [];
  const sweepStarted = performance.now();
  const plan = await sweepFollowupsYielding(followups, inquiries, { onSlice: (busy) => sliceMs.push(busy) });
  const sweepMs = Math.round(performance.now() - sweepStarted);
  polling = false;
  await poller;
  server.close();

  const healthMax = healthMs.length === 0 ? null : Math.round(Math.max(...healthMs));
  console.log(
    JSON.stringify({
      listPageMs: listMs,
      inquiryIndexMs: indexMs,
      sweepMs,
      healthSamples: healthMs.length,
      healthMaxMs: healthMax,
      sliceMaxMs: sliceMs.length === 0 ? null : Math.round(Math.max(...sliceMs)),
      wouldClose: plan.wouldClose,
      suspect: plan.suspect,
      otherBrand: plan.otherBrand,
      past: plan.past,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
