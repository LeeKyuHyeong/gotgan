import axios from 'axios'
import { clearAuth, getHouseholdId, getToken } from '../lib/auth'

// Vite 프록시로 /api → 8083. baseURL 은 비워두고 상대경로 사용.
export const api = axios.create({
  baseURL: '/',
})

// 요청마다 토큰 + 현재 가구 헤더 자동 첨부
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const hid = getHouseholdId()
  if (hid != null) {
    config.headers['X-Household-Id'] = String(hid)
  }
  return config
})

// 401 → 인증 만료. 로그인으로.
// 단, 로그인 엔드포인트(/api/auth/*) 자체의 401은 "교환 실패"지 만료가 아님 —
// 가로채면 콜백 화면이 에러를 보여주기 전에 /login 으로 튕겨서 원인이 영영 안 보인다.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url: string = error.config?.url ?? ''
    if (error.response?.status === 401 && !url.startsWith('/api/auth/')) {
      clearAuth()
      if (location.pathname !== '/login') {
        location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

/** 에러 메시지 추출(백엔드 ErrorResponse.message). */
export function errorMessage(e: unknown, fallback = '오류가 발생했습니다.'): string {
  if (axios.isAxiosError(e)) {
    return (e.response?.data as { message?: string })?.message ?? fallback
  }
  return fallback
}
