import { useRef, useState, type ReactNode } from 'react'

const THRESHOLD = 64 // 이만큼 당기면 새로고침
const MAX = 96 // 인디케이터 최대 높이
const RESIST = 0.5 // 당김 저항 (실제 이동량의 절반만 반영)

/**
 * 모바일 당겨서 새로고침. 문서(window) 스크롤이 맨 위일 때만 작동.
 * onRefresh 는 보통 React Query refetch() 를 반환 — 완료될 때까지 스피너 유지.
 */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown>
  children: ReactNode
}) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)

  function atTop() {
    return (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0
  }

  function onTouchStart(e: React.TouchEvent) {
    startY.current = !refreshing && atTop() ? e.touches[0].clientY : null
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startY.current == null) return
    const dy = e.touches[0].clientY - startY.current
    // 위로 스크롤하려는 동작이거나 이미 스크롤이 내려가 있으면 취소
    if (dy <= 0 || !atTop()) {
      startY.current = null
      setPull(0)
      return
    }
    setPull(Math.min(MAX, dy * RESIST))
  }

  async function onTouchEnd() {
    if (startY.current == null) return
    startY.current = null
    if (pull >= THRESHOLD) {
      setRefreshing(true)
      setPull(THRESHOLD)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPull(0)
      }
    } else {
      setPull(0)
    }
  }

  const height = refreshing ? THRESHOLD : pull
  const ready = pull >= THRESHOLD

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden text-ink-soft"
        style={{ height, transition: startY.current == null ? 'height 0.2s' : undefined }}
      >
        <span
          className={`text-xl ${refreshing ? 'animate-spin' : ''}`}
          style={{ opacity: Math.min(1, pull / THRESHOLD), transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }}
        >
          {refreshing || ready ? '↻' : '↓'}
        </span>
      </div>
      {children}
    </div>
  )
}
