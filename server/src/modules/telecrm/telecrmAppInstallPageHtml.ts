import type { TelecrmAppManifest } from './telecrmAppManifest.js';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 카카오톡·구형 인앱 브라우저 — React SPA 없이 설치 페이지 직접 제공 */
export function renderTelecrmAppInstallPageHtml(
  manifest: TelecrmAppManifest,
  pageUrl: string,
): string {
  const versionLabel = escapeHtml(`${manifest.latestVersionName} (${manifest.latestVersionCode})`);
  const releaseNotes = manifest.releaseNotes?.trim()
    ? `<p class="notes">${escapeHtml(manifest.releaseNotes.trim())}</p>`
    : '';
  const downloadUrl = manifest.downloadUrl?.trim() ?? '';
  const hasDownload = downloadUrl.length > 0;
  const safeDownloadUrl = escapeHtml(downloadUrl);
  const safePageUrl = escapeHtml(pageUrl);
  const title = '청소비서 전화 설치';
  const description = '사무실 휴대폰용 청소비서 전화 앱 APK 설치';

  const installBlock = hasDownload
    ? `<a class="btn" href="${safeDownloadUrl}">청소비서 전화 설치</a>`
    : `<p class="warn">지금은 설치 파일이 준비되지 않았습니다. 관리자에게 문의하세요.</p>`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#0f172a" />
  <title>${title}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${safePageUrl}" />
  <meta name="twitter:card" content="summary" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Noto Sans KR", system-ui, -apple-system, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      line-height: 1.5;
    }
    .header {
      background: #0f172a;
      color: #fff;
      padding: 1rem 1.25rem;
    }
    .header small { display: block; color: #cbd5e1; font-size: 0.75rem; margin-bottom: 0.25rem; }
    .header h1 { margin: 0; font-size: 1.125rem; font-weight: 600; }
    main { max-width: 28rem; margin: 0 auto; padding: 2rem 1rem; }
    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      padding: 1.5rem;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    }
    .lead { margin: 0 0 1.25rem; color: #475569; font-size: 0.9375rem; }
    .version {
      text-align: center;
      background: #f8fafc;
      border-radius: 0.75rem;
      padding: 0.875rem 1rem;
      margin-bottom: 1rem;
    }
    .version small { display: block; color: #64748b; font-size: 0.75rem; }
    .version strong { display: block; margin-top: 0.25rem; font-size: 1rem; }
    .notes { margin: 0.5rem 0 0; font-size: 0.8125rem; color: #64748b; }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 3.25rem;
      width: 100%;
      border-radius: 1rem;
      background: #0f172a;
      color: #fff;
      font-size: 1rem;
      font-weight: 600;
      text-decoration: none;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
    }
    .warn {
      margin: 0;
      padding: 0.875rem 1rem;
      border-radius: 0.75rem;
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
      font-size: 0.875rem;
    }
    ol {
      margin: 1.25rem 0 0;
      padding-left: 1.25rem;
      color: #64748b;
      font-size: 0.8125rem;
    }
    ol li { margin-bottom: 0.5rem; }
    .foot {
      margin-top: 1.5rem;
      text-align: center;
      font-size: 0.75rem;
      color: #94a3b8;
    }
    .block-warn {
      margin: 1rem 0 0;
      padding: 0.875rem 1rem;
      border-radius: 0.75rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      font-size: 0.8125rem;
    }
    .block-warn strong { display: block; margin-bottom: 0.35rem; }
  </style>
</head>
<body>
  <header class="header">
    <small>청소비서</small>
    <h1>전화 앱 설치</h1>
  </header>
  <main>
    <div class="card">
      <p class="lead">사무실 휴대폰에 <strong>청소비서 전화</strong> 앱을 설치합니다. PC 텔레CRM과 같은 계정으로 로그인해 사용하세요.</p>
      <div class="version">
        <small>최신 버전</small>
        <strong>v${versionLabel}</strong>
        ${releaseNotes}
      </div>
      ${installBlock}
      <ol>
        <li>위 버튼을 누르면 APK가 다운로드됩니다.</li>
        <li>다운로드가 끝나면 <strong>「내 파일」</strong> 앱에서 APK를 열고 「설치」를 누르세요. (Chrome에서 바로 열면 차단될 수 있음)</li>
        <li>처음 한 번은 「출처를 알 수 없는 앱」설치를 허용해야 할 수 있습니다.</li>
        <li>이미 앱이 있으면 덮어씌워 설치됩니다. 이후 새 버전은 앱 실행 시 안내됩니다.</li>
      </ol>
      <div class="block-warn">
        <strong>삼성 「악성 앱으로 의심 · 제한 해제 불가능」이 뜨면</strong>
        휴대폰 설정만으로는 풀리지 않는 <em>강제 차단</em>입니다. 사무실 PC + USB 케이블로 설치하세요.
        PC에서 APK 받기 → 휴대폰 「개발자 옵션 → USB 디버깅」 켜기 → PC에서 <code>adb install -r telecrm-release.apk</code>
        (상세: 저장소 <code>apps/telecrm-android/scripts/install-via-adb.ps1</code>)
      </div>
    </div>
    <p class="foot">이 주소(${safePageUrl})는 바뀌지 않습니다. 새 버전이 나와도 같은 링크에서 최신 APK를 받을 수 있습니다.</p>
  </main>
</body>
</html>`;
}
