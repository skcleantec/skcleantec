/* eslint-disable no-undef */
self.addEventListener('push', (event) => {
  let data = { title: 'SK클린텍', body: '', url: '/team/schedule' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.ico',
      data: { url: data.url || '/team/schedule' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = event.notification.data?.url || '/team/schedule';
  const path = raw.startsWith('http') ? new URL(raw).pathname + new URL(raw).search : raw.startsWith('/') ? raw : '/team/schedule';
  const target = self.location.origin + path;
  event.waitUntil(self.clients.openWindow(target));
});
