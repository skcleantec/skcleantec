#!/usr/bin/env node
/**
 * 운영·스테이징 FCM 연동 상태 점검
 *   node scripts/probe-staff-push-status.mjs --base https://www.cbiseo.com --tenant cbiseo --email cbiseo --password ****
 */
const args = process.argv.slice(2);
function getArg(name, fallback = '') {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const base = getArg('base', 'https://www.cbiseo.com').replace(/\/$/, '');
const tenantSlug = getArg('tenant', 'cbiseo');
const email = getArg('email', 'cbiseo');
const password = getArg('password', '1234');

async function main() {
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantSlug, email, password }),
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok) {
    console.error('LOGIN FAIL', loginRes.status, loginBody);
    process.exit(1);
  }
  const jwt = loginBody.token;
  console.log('login ok', { tenant: loginBody.tenant?.slug, role: loginBody.user?.role, userId: loginBody.user?.id });

  const statusRes = await fetch(`${base}/api/push/staff-app/status`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const status = await statusRes.json().catch(() => ({}));
  console.log('\n=== /api/push/staff-app/status ===');
  console.log(JSON.stringify(status, null, 2));

  console.log('\n=== 해석 ===');
  if (!status.fcmServerConfigured) {
    console.log('❌ 서버 FIREBASE_SERVICE_ACCOUNT_JSON 미설정 → Railway production Variables 확인');
  } else {
    console.log('✅ 서버 FCM Admin 설정됨');
  }
  if (!status.hasRegisteredToken) {
    console.log('❌ 이 계정에 등록된 FCM 토큰 없음 → Play 앱 v19+ 로그인 후 「알림 설정」에서 서버 등록 새로고침 (실패 사유가 빨간 글씨로 표시됨)');
  } else {
    console.log(`✅ FCM 토큰 등록됨 (${status.deviceLabel ?? 'device'}) @ ${status.tokenUpdatedAt}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
