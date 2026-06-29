/**
 * 멀티테넌트 전수 점검 — 정적 패턴 스캔 + celebration feed + (선택) API phase 스크립트
 * cd server && npx tsx scripts/verify-multitenant-full-audit.ts
 * API phase: RUN_API=1 npx tsx scripts/verify-multitenant-full-audit.ts
 */
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import './loadServerEnv.js';
import { listCelebrationFeedAfter, appendCelebrationToFeed, getCelebrationFeedHeadId } from '../src/modules/realtime/celebrationFeedStore.js';

const __dir = fileURLToPath(new URL('.', import.meta.url));
const serverRoot = join(__dir, '..');
const modulesRoot = join(serverRoot, 'src', 'modules');

type Finding = { severity: 'critical' | 'warn' | 'info'; file: string; line: number; rule: string; snippet: string };

const findings: Finding[] = [];

function hasTenantGuardBefore(lines: string[], lineIndex: number, mutateLine: string): boolean {
  if (/owned\.|existing\.|scoped\.|row\.id|group\.id/.test(mutateLine)) return true;
  const window = lines.slice(Math.max(0, lineIndex - 70), lineIndex).join('\n');
  if (/findInquiryForTenant|findFirstForTenant|findGroupForTenant|owned\s*=|existing\s*=|requireTenantIdFromAuth/.test(window)) {
    return true;
  }
  if (/user\.userId/.test(mutateLine) && /resolveTeamContextTenantId|authMiddleware/.test(window)) {
    return true;
  }
  const idMatch = mutateLine.match(/id:\s*(\w+)/);
  if (!idMatch) return false;
  const idVar = idMatch[1];
  const scoped = new RegExp(
    `findFirst\\([\\s\\S]{0,400}(tenantId|user:\\s*\\{\\s*tenantId)[\\s\\S]{0,200}id:\\s*${idVar}|findFirst\\([\\s\\S]{0,400}id:\\s*${idVar}[\\s\\S]{0,200}(tenantId|user:\\s*\\{\\s*tenantId)`,
  );
  if (scoped.test(window)) return true;
  const invScoped = new RegExp(`(?:inv|inquiry|row|owned|existing)[\\s\\S]{0,30}\\.[\\s\\S]{0,80}tenantId`);
  if (invScoped.test(window) && window.includes(idVar)) return true;
  return false;
}

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'platform') continue;
      walkTs(p, out);
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
      out.push(p);
    }
  }
  return out;
}

function scanFile(path: string): void {
  const rel = relative(serverRoot, path).replace(/\\/g, '/');
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');

  const isRoute = rel.includes('.routes.ts') || rel.endsWith('Routes.ts');
  const isPublic = rel.includes('public') || rel.includes('orderform.routes');

  lines.forEach((line, i) => {
    const n = i + 1;
    const trimmed = line.trim();

    if (/findUnique\(\{\s*where:\s*\{\s*id:/.test(line) && !/tenantId/.test(line)) {
      if (rel.includes('platform/')) return;
      if (/user\.findUnique|User\.findUnique|platformUser|Tenant\.findUnique|tenant\.findUnique/.test(line)) return;
      if (/passwordHash|dbUser/.test(lines.slice(Math.max(0, i - 3), i + 2).join('\n'))) return;
      findings.push({
        severity: isRoute ? 'warn' : 'info',
        file: rel,
        line: n,
        rule: 'findUnique-by-id-only',
        snippet: trimmed.slice(0, 120),
      });
    }

    if (isRoute && /\.(update|delete)\(\{\s*where:\s*\{\s*id:/.test(line) && !/tenantId/.test(line)) {
      if (hasTenantGuardBefore(lines, i, line)) return;
      findings.push({
        severity: 'critical',
        file: rel,
        line: n,
        rule: 'mutate-by-id-only',
        snippet: trimmed.slice(0, 120),
      });
    }

    if (/findMany\(\{/.test(line) && !/tenantId/.test(line) && isRoute) {
      if (/platformUser|TenantFeature|moduleId/.test(line)) return;
      const ctx = lines.slice(i, Math.min(lines.length, i + 8)).join('\n');
      if (!/prisma\.\w+\.findMany/.test(line)) return;
      if (/tenantId|operatingCompanyId|inquiryId|where:/.test(ctx) && /tenantId/.test(ctx)) return;
      findings.push({
        severity: 'warn',
        file: rel,
        line: n,
        rule: 'findMany-maybe-missing-tenantId',
        snippet: trimmed.slice(0, 120),
      });
    }
  });

  if (text.includes('appendCelebrationToFeed') && !text.includes('tenantId')) {
    findings.push({
      severity: 'critical',
      file: rel,
      line: 1,
      rule: 'celebration-feed-without-tenantId',
      snippet: 'appendCelebrationToFeed without tenantId',
    });
  }

  if (rel.includes('celebrationFeed.routes') && text.includes('listCelebrationFeedAfter') && !text.includes('requireTenantIdFromAuth')) {
    findings.push({
      severity: 'critical',
      file: rel,
      line: 1,
      rule: 'celebration-api-no-tenant-auth',
      snippet: 'celebrations route without requireTenantIdFromAuth',
    });
  }
}

function verifyCelebrationFeedIsolation(): void {
  const TA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const TB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const headBefore = getCelebrationFeedHeadId();
  appendCelebrationToFeed({
    type: 'inquiry:celebrate',
    tenantId: TA,
    inquiryId: 'x',
    registrarName: 'a',
    customerName: 'a',
    inquiryNumber: null,
    source: null,
  });
  appendCelebrationToFeed({
    type: 'inquiry:celebrate',
    tenantId: TB,
    inquiryId: 'y',
    registrarName: 'b',
    customerName: 'b',
    inquiryNumber: null,
    source: null,
  });
  const forA = listCelebrationFeedAfter(headBefore, TA);
  const forB = listCelebrationFeedAfter(headBefore, TB);
  if (forA.some((x) => x.tenantId !== TA)) throw new Error('celebration feed leak into tenant A');
  if (forB.some((x) => x.tenantId !== TB)) throw new Error('celebration feed leak into tenant B');
  if (forA.some((x) => x.customerName === 'b')) throw new Error('celebration feed cross-payload A');
  if (forB.some((x) => x.customerName === 'a')) throw new Error('celebration feed cross-payload B');
}

function runApiPhase(name: string, script: string): { ok: boolean; error?: string } {
  try {
    execSync(`npx tsx scripts/${script}`, {
      cwd: serverRoot,
      stdio: 'pipe',
      encoding: 'utf8',
      env: { ...process.env, VERIFY_API_BASE: process.env.VERIFY_API_BASE ?? 'http://127.0.0.1:3000/api' },
    });
    return { ok: true };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, error: [err.stdout, err.stderr, err.message].filter(Boolean).join('\n').slice(0, 800) };
  }
}

function main() {
  console.info('[verify-multitenant-full-audit] static scan…');
  for (const f of walkTs(modulesRoot)) scanFile(f);
  scanFile(join(modulesRoot, 'realtime', 'celebrationFeedStore.ts'));
  scanFile(join(modulesRoot, 'realtime', 'celebrationFeed.routes.ts'));

  console.info('[verify-multitenant-full-audit] celebration feed isolation…');
  verifyCelebrationFeedIsolation();

  const critical = findings.filter((f) => f.severity === 'critical');
  const warn = findings.filter((f) => f.severity === 'warn');

  console.info(`\n=== Static findings: critical=${critical.length} warn=${warn.length} info=${findings.length - critical.length - warn.length} ===`);

  for (const f of [...critical, ...warn].slice(0, 40)) {
    console.info(`[${f.severity}] ${f.rule} @ ${f.file}:${f.line}`);
    console.info(`  ${f.snippet}`);
  }
  if (critical.length + warn.length > 40) {
    console.info(`  … and ${critical.length + warn.length - 40} more`);
  }

  const apiScripts = [
    'verify-multitenant-cross-tenant-live.ts',
    'verify-celebration-feed-tenant.ts',
    'verify-multitenant-phase6.ts',
    'verify-multitenant-tenant-exchange.ts',
    'verify-multitenant-db-marketplace.ts',
  ];
  const apiScriptsExtended = [
    ...apiScripts,
    'verify-multitenant-phase1.ts',
    'verify-multitenant-phase2.ts',
    'verify-multitenant-phase3.ts',
    'verify-multitenant-phase4.ts',
    'verify-multitenant-phase5.ts',
    'verify-multitenant-phase7.ts',
  ];

  const runApi = process.env.RUN_API === '1' || process.env.RUN_API === 'true';
  const runAllPhases = process.env.RUN_ALL_PHASES === '1' || process.env.RUN_ALL_PHASES === 'true';
  const scriptsToRun = runApi ? (runAllPhases ? apiScriptsExtended : apiScripts) : [];
  const apiResults: { name: string; ok: boolean; error?: string }[] = [];

  if (scriptsToRun.length > 0) {
    console.info('\n=== API phase scripts ===');
    for (const script of scriptsToRun) {
      process.stdout.write(`  ${script} … `);
      const r = runApiPhase(script, script);
      apiResults.push({ name: script, ...r });
      console.info(r.ok ? 'OK' : 'FAIL');
      if (!r.ok) console.info(`    ${r.error?.split('\n')[0] ?? ''}`);
    }
  } else {
    console.info('\n(API phase skipped — RUN_API=1 for core live tests; RUN_ALL_PHASES=1 includes phase1–7)');
  }

  if (critical.length > 0) {
    console.error('\n[verify-multitenant-full-audit] FAIL — critical static findings');
    process.exitCode = 1;
    return;
  }

  const apiFail = apiResults.filter((r) => !r.ok);
  if (apiFail.length > 0) {
    console.error(`\n[verify-multitenant-full-audit] FAIL — API scripts: ${apiFail.map((f) => f.name).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.info('\n[verify-multitenant-full-audit] PASS (no critical static issues; celebration feed OK)');
}

main();
