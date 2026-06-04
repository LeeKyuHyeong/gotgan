// 인증 토큰 + 현재 가구 id 를 localStorage 에 보관.
const TOKEN_KEY = 'stock.token'
const HID_KEY = 'stock.householdId'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getHouseholdId(): number | null {
  const v = localStorage.getItem(HID_KEY)
  return v ? Number(v) : null
}
export function setHouseholdId(id: number) {
  localStorage.setItem(HID_KEY, String(id))
}
export function clearHouseholdId() {
  localStorage.removeItem(HID_KEY)
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(HID_KEY)
}

// 초대 링크(/join?code=)로 들어온 코드를 로그인 과정을 건너 보관.
// 로그인 완료 후 합류 화면이 읽어서 자동 입력한다.
const PENDING_INVITE_KEY = 'stock.pendingInviteCode'

export function getPendingInviteCode(): string | null {
  return localStorage.getItem(PENDING_INVITE_KEY)
}
export function setPendingInviteCode(code: string) {
  localStorage.setItem(PENDING_INVITE_KEY, code)
}
export function clearPendingInviteCode() {
  localStorage.removeItem(PENDING_INVITE_KEY)
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

// --- 무클릭 자동 로그인(카카오 prompt=none) 제어 ---
// 인앱 브라우저 등이 localStorage(토큰)를 날려도 카카오 세션 쿠키는 살아있는 경우가 많아,
// 로그인 화면이 조용히 재인가를 시도해 클릭 없이 복귀시킨다. sessionStorage 라 탭/세션 단위.
const SKIP_SILENT_KEY = 'stock.skipSilentLogin' // 명시적 로그아웃·silent 실패 후 억제(자동 재로그인 루프 방지)
const SILENT_AT_KEY = 'stock.silentLoginAt' // 60초 내 재시도 금지(로그인 직후 401 같은 비정상 루프 차단)

export function canTrySilentLogin(): boolean {
  if (sessionStorage.getItem(SKIP_SILENT_KEY) === '1') return false
  return Date.now() - Number(sessionStorage.getItem(SILENT_AT_KEY) ?? 0) > 60_000
}
export function markSilentLoginAttempt() {
  sessionStorage.setItem(SILENT_AT_KEY, String(Date.now()))
}
export function skipSilentLogin() {
  sessionStorage.setItem(SKIP_SILENT_KEY, '1')
}
export function clearSilentLoginSkip() {
  sessionStorage.removeItem(SKIP_SILENT_KEY)
}
