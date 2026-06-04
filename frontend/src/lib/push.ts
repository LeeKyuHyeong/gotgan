// Web Push 구독 관리 — 곧만료(D-3) 알림.
// 서버: GET /api/push/vapid-public-key, POST·DELETE /api/push/subscriptions
import { api } from '../api/client'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

/** 카카오톡/인스타 등 인앱 브라우저 — 푸시 API 자체가 없음. */
export function isInAppBrowser(): boolean {
  return /KAKAOTALK|Instagram|FBAN|FBAV|NAVER/i.test(navigator.userAgent)
}

/** iOS 푸시는 홈 화면에 추가된 standalone 모드에서만 가능. */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  )
}

async function swRegistration(): Promise<ServiceWorkerRegistration> {
  // register 는 이미 등록돼 있으면 기존 등록을 반환 (main.tsx 의 등록과 충돌 없음)
  return navigator.serviceWorker.register('/sw.js')
}

/** 현재 기기의 구독 상태 (없으면 null). */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await swRegistration()
  return reg.pushManager.getSubscription()
}

/** 권한 요청 → 구독 → 서버 등록. 실패 시 사용자에게 보여줄 메시지로 throw. */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) {
    if (isInAppBrowser()) {
      throw new Error('카카오톡 등 앱 안 브라우저에서는 알림을 켤 수 없어요. Chrome이나 Safari로 열어주세요.')
    }
    throw new Error(
      isIos() && !isStandalone()
        ? '아이폰은 Safari 공유 버튼 → "홈 화면에 추가" 후, 그 앱에서 켤 수 있어요.'
        : '이 브라우저는 알림을 지원하지 않아요.',
    )
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('알림 권한이 꺼져 있어요. 브라우저 설정에서 허용해주세요.')
  }
  const reg = await swRegistration()
  const { data } = await api.get<{ publicKey: string }>('/api/push/vapid-public-key')
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.publicKey),
  })
  const json = sub.toJSON()
  await api.post('/api/push/subscriptions', {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  })
}

/** 서버 등록 해제 + 브라우저 구독 해지. */
export async function disablePush(): Promise<void> {
  const sub = await getPushSubscription()
  if (!sub) return
  // 서버 삭제가 실패해도 로컬 해지는 진행 (죽은 구독은 발송 시 410으로 자동 정리됨)
  await api.delete('/api/push/subscriptions', { data: { endpoint: sub.endpoint } }).catch(() => {})
  await sub.unsubscribe()
}

/** VAPID 공개키(base64url) → pushManager.subscribe 가 받는 Uint8Array(ArrayBuffer 명시 — BufferSource 타입 충족). */
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}
