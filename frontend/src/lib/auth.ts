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

export function isLoggedIn(): boolean {
  return !!getToken()
}
