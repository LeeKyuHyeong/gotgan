import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

/** 전체 화면 로딩. */
export function LoadingScreen({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <div className="flex h-screen items-center justify-center text-ink-soft text-sm">
      {label}
    </div>
  )
}

/** 상단 앱바. back=true 면 뒤로가기 버튼. */
export function AppHeader({
  title,
  back,
  right,
}: {
  title: string
  back?: boolean
  right?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 bg-bg/90 px-4 pt-4 pb-2 backdrop-blur">
      {back && (
        <button
          onClick={() => navigate(-1)}
          className="text-2xl leading-none text-ink-soft"
          aria-label="뒤로"
        >
          ‹
        </button>
      )}
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <div className="ml-auto">{right}</div>
    </header>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'brand' | 'ghost' | 'kakao' | 'danger'
}

export function Button({ variant = 'brand', className = '', ...props }: BtnProps) {
  const styles: Record<string, string> = {
    brand: 'bg-brand text-white',
    ghost: 'bg-transparent text-ink-soft border border-line',
    kakao: 'bg-kakao text-kakao-ink',
    danger: 'bg-transparent text-danger border border-danger/30',
  }
  return (
    <button
      {...props}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-[15px] font-bold disabled:opacity-50 ${styles[variant]} ${className}`}
    />
  )
}

/** 작은 알약 라벨. */
export function Pill({
  children,
  tone = 'muted',
}: {
  children: ReactNode
  tone?: 'warn' | 'brand' | 'muted'
}) {
  const tones: Record<string, string> = {
    warn: 'bg-warn-soft text-warn',
    brand: 'bg-brand-soft text-brand',
    muted: 'bg-line/60 text-ink-soft',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}

/** dDay → 곧만료 뱃지 (D-3 이내만). */
export function ExpiryBadge({ dDay }: { dDay: number | null }) {
  if (dDay == null || dDay < 0 || dDay > 3) return null
  return <Pill tone="warn">D-{dDay}</Pill>
}

export function ErrorText({ message }: { message?: string | null }) {
  if (!message) return null
  return <p className="mt-2 text-center text-xs text-danger">{message}</p>
}

/** 우하단 플로팅 추가 버튼. 가운데 정렬된 앱 컬럼 우측에 고정. */
export function Fab({ onClick, label = '추가' }: { onClick: () => void; label?: string }) {
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 flex w-[480px] max-w-full -translate-x-1/2 justify-end px-5">
      <button
        onClick={onClick}
        aria-label={label}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand text-3xl leading-none text-white shadow-lg shadow-brand/40"
      >
        ＋
      </button>
    </div>
  )
}
