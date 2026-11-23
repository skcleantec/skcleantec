import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyFollowupMerge,
  buildMergedFollowupData,
  groupDuplicateFollowups,
  mergeInquiryConflict,
  replacePhonesForTargetSave,
  rowMatchesSimilarCandidate,
  similarNameMode,
  targetFollowupRejectReason,
  type FollowupMergeWriter,
} from './orderFollowupIdentity.service.js';

const day = (iso: string) => new Date(iso);

function row(partial: {
  id: string;
  createdAt: string;
  customerName?: string;
  nickname?: string | null;
  customerPhone?: string;
  customerPhone2?: string | null;
  inquiryId?: string | null;
  deferCount?: number;
  memo?: string | null;
  goldDb?: boolean;
  address?: string | null;
  status?: 'ABSENT' | 'ON_HOLD';
}) {
  return {
    id: partial.id,
    operatingCompanyId: 'brand-a',
    customerName: partial.customerName ?? '김청소',
    nickname: partial.nickname ?? null,
    customerPhone: partial.customerPhone ?? '',
    customerPhone2: partial.customerPhone2 ?? null,
    status: partial.status ?? 'ABSENT',
    deferCount: partial.deferCount ?? 0,
    memo: partial.memo ?? null,
    createdAt: day(partial.createdAt),
    inquiryId: partial.inquiryId ?? null,
    goldDb: partial.goldDb ?? false,
    preferredMoveInCleaningDate: null,
    address: partial.address ?? null,
    areaPyeong: null,
    roomCount: null,
    bathroomCount: null,
    balconyCount: null,
    isOneRoom: false,
    oneRoomLoft: null,
    oneRoomSlidingPartition: null,
    structureBalconyNonExpanded: null,
    structurePartitionWall: null,
    structureOutdoorTerrace: null,
    leadSource: null,
    nextContactAt: null,
    depositReceivedAt: null,
  };
}

describe('지정 행에 덮어쓰기', () => {
  it('새 휴대폰은 연락처1을 바꾸고 안심번호는 둔다', () => {
    const next = replacePhonesForTargetSave({
      prevPhone: '01011112222',
      prevPhone2: '050412341234',
      nextPhone: '01099998888',
      nextPhone2: null,
    });
    assert.equal(next.customerPhone, '01099998888');
    assert.equal(next.customerPhone2, '050412341234');
    assert.equal(next.customerPhone.includes('1111'), false);
  });

  it('전화번호 없음은 기존 번호를 지우지 않는다', () => {
    const next = replacePhonesForTargetSave({
      prevPhone: '01011112222',
      prevPhone2: '050412341234',
      nextPhone: '',
      nextPhone2: null,
    });
    assert.equal(next.customerPhone, '01011112222');
    assert.equal(next.customerPhone2, '050412341234');
  });

  it('다른 브랜드이거나 처리 완료면 거절한다', () => {
    assert.match(
      targetFollowupRejectReason({ operatingCompanyId: 'brand-b', status: 'ABSENT' }, 'brand-a') ?? '',
      /이 브랜드/,
    );
    assert.match(
      targetFollowupRejectReason({ operatingCompanyId: 'brand-a', status: 'FULFILLED' }, 'brand-a') ?? '',
      /처리 완료/,
    );
    assert.equal(targetFollowupRejectReason({ operatingCompanyId: 'brand-a', status: 'ABSENT' }, 'brand-a'), null);
  });
});

describe('같은 고객 후보', () => {
  it('고객 또는 한 글자 이름은 닉네임으로만 찾고, 번호가 겹치면 뺀다', () => {
    assert.equal(similarNameMode('고객', ''), 'none');
    assert.equal(similarNameMode('김', '별명'), 'nickname');
    const query = {
      customerName: '고객',
      nickname: '별명',
      leadSource: '숨고',
      customerPhone: '01011112222',
      customerPhone2: null,
    };
    assert.equal(
      rowMatchesSimilarCandidate(
        {
          customerName: '다른이름',
          nickname: '별명',
          leadSource: '미소',
          customerPhone: '01033334444',
          customerPhone2: null,
        },
        query,
      ),
      true,
    );
    assert.equal(
      rowMatchesSimilarCandidate(
        {
          customerName: '고객',
          nickname: '다른별명',
          leadSource: '숨고',
          customerPhone: '',
          customerPhone2: null,
        },
        query,
      ),
      false,
    );
    assert.equal(
      rowMatchesSimilarCandidate(
        {
          customerName: '다른이름',
          nickname: '별명',
          leadSource: '숨고',
          customerPhone: '010-1111-2222',
          customerPhone2: null,
        },
        query,
      ),
      false,
    );
  });
});

describe('중복 합치기', () => {
  it('이름 또는 번호가 같으면 한 묶음이 된다', () => {
    const groups = groupDuplicateFollowups([
      row({ id: 'a', createdAt: '2026-11-01T00:00:00.000Z', nickname: '별명', customerPhone: '01011112222' }),
      row({ id: 'b', createdAt: '2026-11-02T00:00:00.000Z', nickname: '별명', customerPhone: '01033334444' }),
      row({ id: 'c', createdAt: '2026-11-03T00:00:00.000Z', nickname: '다른', customerPhone: '01033334444' }),
      row({ id: 'd', createdAt: '2026-11-04T00:00:00.000Z', nickname: '혼자', customerPhone: '01055556666' }),
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0]?.map((item) => item.id).sort(), ['a', 'b', 'c']);
  });

  it('접수가 다르면 합치지 않고, 빈 칸과 횟수와 연락처만 채운다', () => {
    const keep = row({
      id: 'keep',
      createdAt: '2026-11-01T00:00:00.000Z',
      memo: '먼저',
      deferCount: 1,
      inquiryId: 'inq-1',
      customerPhone: '',
    });
    const other = row({
      id: 'other',
      createdAt: '2026-11-02T00:00:00.000Z',
      memo: '나중',
      deferCount: 2,
      inquiryId: 'inq-2',
      address: '서울',
      customerPhone: '01099998888',
      customerPhone2: '050412341234',
    });
    assert.equal(mergeInquiryConflict([keep, other]), true);
    const sameInquiry = buildMergedFollowupData(keep, [{ ...other, inquiryId: 'inq-1' }]);
    assert.equal(sameInquiry.memo, '먼저\n나중');
    assert.equal(sameInquiry.deferCount, 3);
    assert.equal(sameInquiry.address, '서울');
    assert.equal(sameInquiry.customerPhone, '01099998888');
    assert.equal(sameInquiry.customerPhone2, '050412341234');
    assert.equal(sameInquiry.inquiryId, 'inq-1');
  });

  it('로그·가망 표시·견적을 keep 으로 옮기고 합친 행은 지운다', async () => {
    const logs = [
      { id: 'log-1', followupId: 'other' },
      { id: 'log-2', followupId: 'keep' },
    ];
    const marks = [
      { id: 'mark-keep', followupId: 'keep', userId: 'user-1', contactTries: 1 },
      { id: 'mark-clash', followupId: 'other', userId: 'user-1', contactTries: 2 },
      { id: 'mark-move', followupId: 'other', userId: 'user-2', contactTries: 4 },
    ];
    const quotes = [{ id: 'quote-1', followupId: 'other' }];
    const deleted: string[] = [];
    const created: { action: string; followupId: string }[] = [];
    const db: FollowupMergeWriter = {
      orderFollowupLog: {
        async updateMany({ where, data }) {
          for (const log of logs) {
            if (where.followupId.in.includes(log.followupId)) log.followupId = data.followupId;
          }
        },
        async create({ data }) {
          created.push({ action: data.action, followupId: data.followupId });
          logs.push({ id: 'log-new', followupId: data.followupId });
        },
      },
      orderFollowupHotMark: {
        async findMany({ where }) {
          const ids = typeof where.followupId === 'string' ? [where.followupId] : where.followupId.in;
          return marks.filter((mark) => ids.includes(mark.followupId));
        },
        async update({ where, data }) {
          const mark = marks.find((item) => item.id === where.id);
          if (!mark) return;
          if (data.followupId) mark.followupId = data.followupId;
          if (data.contactTries != null) mark.contactTries = data.contactTries;
        },
        async delete({ where }) {
          const index = marks.findIndex((item) => item.id === where.id);
          if (index >= 0) marks.splice(index, 1);
        },
      },
      telecrmConsultationQuote: {
        async updateMany({ where, data }) {
          for (const quote of quotes) {
            if (where.followupId.in.includes(quote.followupId)) quote.followupId = data.followupId;
          }
        },
      },
      orderFollowup: {
        async update() {
          return undefined;
        },
        async deleteMany({ where }) {
          deleted.push(...where.id.in);
        },
      },
    };
    const keep = row({ id: 'keep', createdAt: '2026-11-01T00:00:00.000Z', inquiryId: null });
    const other = row({ id: 'other', createdAt: '2026-11-02T00:00:00.000Z', inquiryId: null, deferCount: 1 });
    await applyFollowupMerge(db, { tenantId: 'tenant-1', actorId: 'admin-1', keep, merges: [other] });
    assert.deepEqual(deleted, ['other']);
    assert.equal(logs.every((log) => log.followupId === 'keep'), true);
    assert.equal(quotes[0]?.followupId, 'keep');
    assert.equal(marks.find((mark) => mark.id === 'mark-keep')?.contactTries, 3);
    assert.equal(marks.some((mark) => mark.id === 'mark-clash'), false);
    assert.equal(marks.find((mark) => mark.id === 'mark-move')?.followupId, 'keep');
    assert.equal(created[0]?.action, 'MERGE');
  });
});
