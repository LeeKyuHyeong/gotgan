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
