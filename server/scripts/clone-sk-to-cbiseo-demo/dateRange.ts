/** KST 기준 롤링 N일 구간 (UTC Date for Prisma) */
export function kstRollingFromDays(days: number): Date {
  const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const from = new Date(kstNow);
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  // KST midnight → UTC (subtract 9h)
  return new Date(from.getTime() - 9 * 60 * 60 * 1000);
}
