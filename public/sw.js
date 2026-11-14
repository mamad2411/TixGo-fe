// Service worker TixGo: hanya menangani Web Push (tanpa cache offline). Payload dari BE: { title, body, url }.
self.addEventListener('push', (event) => {
  let d
  try {
    d = event.data ? event.data.json() : {}
  } catch {
    d = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(d.title || 'TixGo', {
      body: d.body || '',
      icon: '/apple-touch-icon.png',
      badge: '/favicon.svg',
      data: { url: typeof d.url === 'string' && d.url.startsWith('/') ? d.url : '/notifikasi' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/notifikasi'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
