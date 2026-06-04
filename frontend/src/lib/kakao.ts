// 카카오 JS SDK 로더 + 초대 공유 헬퍼.
// 공유(Kakao.Share)는 REST API 키가 아니라 **JavaScript 키**(VITE_KAKAO_JS_KEY)가 필요하다.
// 카카오 콘솔: 앱 > 앱 키 > JavaScript 키. 그리고 플랫폼 > Web 에 도메인(localhost:5173, 운영 도메인) 등록 필수.
const SDK_SRC = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.1/kakao.min.js'
const SDK_INTEGRITY = 'sha384-OL+ylM/iuPLtW5U3XcvLSGhE8JzReKDank5InqlHGWPhb4140/yrBw0bg0y7+C9J'

let loadPromise: Promise<KakaoSdk | null> | null = null

/** SDK 스크립트를 1회 주입하고 JS 키로 init. 키가 없으면 null. */
export function ensureKakao(): Promise<KakaoSdk | null> {
  if (loadPromise) return loadPromise
  const key = import.meta.env.VITE_KAKAO_JS_KEY
  if (!key) {
    loadPromise = Promise.resolve(null)
    return loadPromise
  }

  loadPromise = new Promise<KakaoSdk | null>((resolve) => {
    const existing = window.Kakao
    const init = (k: KakaoSdk) => {
      if (!k.isInitialized()) k.init(key)
      resolve(k)
    }
    if (existing) return init(existing)

    const script = document.createElement('script')
    script.src = SDK_SRC
    script.integrity = SDK_INTEGRITY
    script.crossOrigin = 'anonymous'
    script.async = true
    script.onload = () => (window.Kakao ? init(window.Kakao) : resolve(null))
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
  return loadPromise
}

/** 초대 딥링크 — 열면 코드 자동 입력된 합류 화면으로 이어진다(/join 라우트). */
export function inviteJoinUrl(inviteCode: string): string {
  return `${location.origin}/join?code=${encodeURIComponent(inviteCode)}`
}

/** 카카오톡으로 초대코드 공유. 성공 시 true. SDK/키 미설정이면 false(호출측이 fallback). */
export async function shareInviteKakao(inviteCode: string): Promise<boolean> {
  const kakao = await ensureKakao()
  if (!kakao?.Share) return false
  const url = inviteJoinUrl(inviteCode)
  kakao.Share.sendDefault({
    objectType: 'text',
    text: `🏠 곳간에 초대합니다!\n초대코드: ${inviteCode}\n아래 버튼을 누르면 바로 합류할 수 있어요.`,
    link: { mobileWebUrl: url, webUrl: url },
    buttonTitle: '곳간에서 합류하기',
  })
  return true
}

// --- 최소 타입 선언 (공식 @types 미설치) ---
interface KakaoShareLink {
  mobileWebUrl?: string
  webUrl?: string
}
interface KakaoShareTextSettings {
  objectType: 'text'
  text: string
  link: KakaoShareLink
  buttonTitle?: string
}
export interface KakaoSdk {
  init(key: string): void
  isInitialized(): boolean
  Share?: { sendDefault(settings: KakaoShareTextSettings): void }
}
declare global {
  interface Window {
    Kakao?: KakaoSdk
  }
}
