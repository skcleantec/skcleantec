import { prisma } from '../../lib/prisma.js';
import { kstDayRangeYmd } from '../inquiries/inquiryListDateRange.js';
import { getTelecrmCallSessionSummary } from './telecrmCallSession.service.js';

export type TelecrmWorkdeskStats = {
  day: string;
  callCount: number;
  totalDurationSec: number;
  connectedCount: number;
  noAnswerCount: number;
  dialAttemptCount: number;
  connectedDurationSec: number;
  lastConnectedAt: string | null;
  receivedCount: number;
  absentHoldCount: number;
};

export async function getTelecrmWorkdeskStats(
  tenantId: string,
  userId: string,
  dayYmd: string,
): Promise<TelecrmWorkdeskStats> {
  const range = kstDayRangeYmd(dayYmd);
  const callSummary = await getTelecrmCallSessionSummary(tenantId, userId, dayYmd);

  if (!range) {
    return {
      day: dayYmd,
      callCount: callSummary.connectedCount,
      totalDurationSec: callSummary.connectedDurationSec,
      connectedCount: callSummary.connectedCount,
      noAnswerCount: callSummary.noAnswerCount,
      dialAttemptCount: callSummary.dialAttemptCount,
      connectedDurationSec: callSummary.connectedDurationSec,
      lastConnectedAt: callSummary.lastConnectedAt,
      receivedCount: 0,
      absentHoldCount: 0,
    };
  }

  const [receivedCount, absentHoldCount] = await Promise.all([
    prisma.inquiry.count({
      where: {
        tenantId,
        createdById: userId,
        status: 'RECEIVED',
        createdAt: { gte: range.gte, lte: range.lte },
      },
    }),
    prisma.orderFollowup.count({
      where: {
        tenantId,
        createdById: userId,
        status: { in: ['ABSENT', 'ON_HOLD'] },
        createdAt: { gte: range.gte, lte: range.lte },
      },
    }),
  ]);

  return {
    day: dayYmd,
    callCount: callSummary.connectedCount,
    totalDurationSec: callSummary.connectedDurationSec,
    connectedCount: callSummary.connectedCount,
    noAnswerCount: callSummary.noAnswerCount,
    dialAttemptCount: callSummary.dialAttemptCount,
    connectedDurationSec: callSummary.connectedDurationSec,
    lastConnectedAt: callSummary.lastConnectedAt,
    receivedCount,
    absentHoldCount,
  };
}
