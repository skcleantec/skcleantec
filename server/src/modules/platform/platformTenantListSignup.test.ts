import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isNewTenantSignup, platformTenantSignupMeta } from './platformTenantListSignup.ts';

const now = new Date('2026-11-17T06:00:00.000Z');

describe('platform tenant signup list', () => {
  it('오늘을 포함한 30일만 신규', () => {
    assert.equal(isNewTenantSignup('2026-11-17T00:00:00.000Z', now), true);
    assert.equal(isNewTenantSignup('2026-10-18T15:00:00.000Z', now), true);
    assert.equal(isNewTenantSignup('2026-10-17T15:00:00.000Z', now), false);
  });

  it('이벤트 아이디가 있고 종료가 남았을 때만 이벤트', () => {
    const active = platformTenantSignupMeta(
      {
        createdAt: '2026-01-01T00:00:00.000Z',
        trialEndsAt: '2027-01-12T00:00:00.000Z',
        config: { signup: { trialEventId: 'evt', trialEventName: '오픈 체험' } },
      },
      now,
    );
    assert.equal(active.eventTrialActive, true);
    assert.equal(active.eventName, '오픈 체험');
    assert.equal(active.eventEndsAt, '2027-01-12T00:00:00.000Z');

    const viaGrace = platformTenantSignupMeta(
      {
        createdAt: '2026-11-01T00:00:00.000Z',
        trialEndsAt: null,
        config: { signup: { trialEventId: 'evt', coinGraceEndsAt: '2027-01-12T00:00:00.000Z' } },
      },
      now,
    );
    assert.equal(viaGrace.eventTrialActive, true);
    assert.equal(viaGrace.trialEndsAt, null);
    assert.equal(viaGrace.eventEndsAt, '2027-01-12T00:00:00.000Z');

    const ended = platformTenantSignupMeta(
      {
        createdAt: '2026-11-01T00:00:00.000Z',
        trialEndsAt: '2026-11-01T00:00:00.000Z',
        config: { signup: { trialEventId: 'evt' } },
      },
      now,
    );
    assert.equal(ended.eventTrialActive, false);

    const noEvent = platformTenantSignupMeta(
      {
        createdAt: '2026-11-16T00:00:00.000Z',
        trialEndsAt: '2027-01-12T00:00:00.000Z',
        config: { signup: {} },
      },
      now,
    );
    assert.equal(noEvent.eventTrialActive, false);
    assert.equal(noEvent.newSignup, true);
  });
});
