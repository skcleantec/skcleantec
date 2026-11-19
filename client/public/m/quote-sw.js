/* 모바일 CRM(/m/quote) 홈 화면 설치용 서비스 워커 — 캐시 없이 네트워크 그대로 전달 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request));
});
