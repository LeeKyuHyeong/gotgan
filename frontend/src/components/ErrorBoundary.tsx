import { Component, type ReactNode } from 'react'
import { LoadErrorScreen } from './ui'

/**
 * 렌더 중 동기 throw 를 잡아 전체 트리가 흰 화면으로 언마운트되는 것을 막는다.
 * (React Query 의 async 에러는 각 화면에서 처리 — 여기는 그 외 렌더 예외용 최후 안전망.)
 * 설치형 PWA 에서 흰 화면은 데이터 삭제 없이 복구 불가라 탈출구가 필수.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('ErrorBoundary caught', error)
  }

  render() {
    if (this.state.hasError) {
      // 새로고침 시도 + (LoadErrorScreen 내장) 로그아웃 후 재로그인 탈출구
      return <LoadErrorScreen onRetry={() => window.location.reload()} />
    }
    return this.props.children
  }
}
