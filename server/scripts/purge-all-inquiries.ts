/**
 * Delete all inquiries + reset daily_inquiry_counters.
 * Cascades: Assignment, InquiryChangeLog, InquiryCleaningPhoto.
 * CsReport.inquiryId -> null. OrderForm and users stay.
 *
 * Local DB:
 *   npm run db:purge:inquiries -- --confirm
 *
 * Deployed DB (Railway, etc.): set DATABASE_URL to production, then:
 *   npm run db:purge:inquiries -- --confirm --allow-remote
 * Or: PURGE_REMOTE_DB=yes with --confirm
 *
 * PowerShell example:
 *   cd server
 *   $env:DATABASE_URL = "postgresql://..."   # paste from Railway
 *   npx tsx scripts/purge-all-inquiries.ts --confirm --allow-remote
 *
 * Railway CLI (project linked):
 *   railway run -- npx tsx scripts/purge-all-inquiries.ts --confirm --allow-remote
 */
import { prisma } from '../src/lib/prisma.js';

function dbHostSummary(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    const db = u.pathname.replace(/^\//, '').split('?')[0] || '(db)';
    return `${u.hostname}:${u.port || '5432'}/${db}`;
  } catch {
    return '(invalid DATABASE_URL)';
  }
}

function isLocalDatabaseUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const h = u.hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '::1';
  } catch {
    return false;
  }
}

async function main() {
  const confirmed =
    process.argv.includes('--confirm') || process.env.PURGE_INQUIRIES_CONFIRM === 'yes';
  if (!confirmed) {
    console.error(
      '[abort] Need --confirm or PURGE_INQUIRIES_CONFIRM=yes.\n' +
        '  Deployed DB also needs --allow-remote or PURGE_REMOTE_DB=yes.',
    );
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl.trim()) {
    console.error('[abort] DATABASE_URL is empty.');
    process.exit(1);
  }

  const local = isLocalDatabaseUrl(dbUrl);
  const allowRemote =
    process.argv.includes('--allow-remote') || process.env.PURGE_REMOTE_DB === 'yes';
  if (!local && !allowRemote) {
    console.error(
      `[abort] Remote DB (${dbHostSummary(dbUrl)}). Add --allow-remote or PURGE_REMOTE_DB=yes.`,
    );
    process.exit(1);
  }

  console.log(
    local ? `[target] local — ${dbHostSummary(dbUrl)}` : `[target] remote — ${dbHostSummary(dbUrl)}`,
  );

  const n = await prisma.inquiry.count();
  console.log(`Rows to delete (inquiries): ${n}`);

  const del = await prisma.inquiry.deleteMany({});
  const counters = await prisma.dailyInquiryCounter.deleteMany({});

  console.log(`Deleted inquiries: ${del.count}`);
  console.log(`Deleted daily_inquiry_counters rows: ${counters.count}`);
  console.log('Done. Order forms, users, CS reports (link cleared) unchanged.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
