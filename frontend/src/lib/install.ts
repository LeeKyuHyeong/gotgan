// PWA 설치 / 인앱 브라우저 탈출 도우미.
// 핵심 문제: 카카오톡 등 인앱 브라우저로 링크를 열면 "홈 화면에 추가"가 없어 설치가 막히고
// localStorage 가 날아가 로그인도 불안정하다 → 기본 브라우저로 빼주는 게 1순위.
import { isInAppBrowser, isIos, isStandalone } from './push'

export { isInAppBrowser, isIos, isStandalone }

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
}

/** 인앱 브라우저 이름(안내 문구용). 모르면 null. */
export function inAppBrowserName(): string | null {
  const ua = navigator.userAgent
  if (/KAKAOTALK/i.test(ua)) return '카카오톡'
  if (/Instagram/i.test(ua)) return '인스타그램'
  if (/FBAN|FBAV/i.test(ua)) return '페이스북'
  if (/NAVER/i.test(ua)) return '네이버 앱'
  if (/Line/i.test(ua)) return '라인'
  if (/DaumApps/i.test(ua)) return '다음 앱'
  return null
}

/** 카카오톡(전 OS)·안드로이드 인앱이면 스킴으로 기본 브라우저 강제 이동이 가능. */
export function canOpenExternal(): boolean {
  return /KAKAOTALK/i.test(navigator.userAgent) || isAndroid()
}

/** 가능한 경우 기본 브라우저로 현재 페이지를 다시 연다. iOS 의 비-카카오 인앱은 스킴이 없어 무동작. */
export function openExternal(): void {
  const url = location.href
  if (/KAKAOTALK/i.test(navigator.userAgent)) {
    // 카카오톡 인앱 → Safari/Chrome 으로 강제 (iOS·Android 모두 동작)
    location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url)
    return
  }
  if (isAndroid()) {
    // 안드로이드 → intent 스킴으로 크롬 열기
    const noScheme = url.replace(/^https?:\/\//, '')
    location.href = `intent://${noScheme}#Intent;scheme=https;package=com.android.chrome;end`
  }
}

/** 현재 URL 복사. 클립보드 권한이 없으면 false. */
export async function copyLink(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(location.href)
    return true
  } catch {
    return false
  }
}

// --- beforeinstallprompt 캡처 (안드로이드 Chrome 네이티브 설치 배너) ---
// 이 이벤트는 React 마운트 전에 발화할 수 있어 모듈 로드 시점에 전역으로 가로채 둔다.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export function hasInstallPrompt(): boolean {
  return deferredPrompt !== null
}

/** 설치 프롬프트 가용 여부 변경 구독(React 동기화용). 해제 함수 반환. */
export function onInstallPromptChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** 네이티브 설치 프롬프트 띄우기. 수락되면 true. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  notify()
  return outcome === 'accepted'
}

// --- 안내 닫음 상태 ---
const IN_APP_DISMISS_KEY = 'stock.inAppNoticeDismissed' // 세션 단위(다음에 또 카톡으로 열면 다시 안내)
const HINT_DISMISS_KEY = 'stock.installHintDismissed' // 영구(한 번 닫으면 그만)

export function isInAppNoticeDismissed(): boolean {
  return sessionStorage.getItem(IN_APP_DISMISS_KEY) === '1'
}
export function dismissInAppNotice(): void {
  sessionStorage.setItem(IN_APP_DISMISS_KEY, '1')
}

export function isInstallHintDismissed(): boolean {
  return localStorage.getItem(HINT_DISMISS_KEY) === '1'
}
export function dismissInstallHint(): void {
  localStorage.setItem(HINT_DISMISS_KEY, '1')
}
