// 곳간 서비스워커 — Web Push 수신/클릭 + 앱셸 캐싱(오프라인 실행/빠른 로드).
// 캐시 전략: 네비게이션은 network-first(항상 최신, 오프라인이면 캐시된 셸) / 해시 정적자산은 cache-first / /api 는 캐시 안 함.
const CACHE = 'gotgan-shell-v1'
const APP_SHELL = '/index.html'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(APP_SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // 동일 출처가 아니거나(API 외부/카카오 SDK 등) API 호출은 캐시에 손대지 않음 — 항상 네트워크.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  // 페이지 네비게이션(SPA 진입): 네트워크 우선, 실패(오프라인) 시 캐시된 앱셸로 폴백.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(APP_SHELL, res.clone()))
          return res
        })
        .catch(() => caches.match(APP_SHELL)),
    )
    return
  }

  // 해시된 정적자산(/assets/...): cache-first — 파일명이 불변이라 안전·빠름.
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})

self.addEventListener('push', (e) => {
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch {
    data = { body: e.data ? e.data.text() : '' }
  }
  e.waitUntil(
    self.registration.showNotification(data.title || '곳간', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // 이미 열린 탭이 있으면 거기로 이동·포커스, 없으면 새 창
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
