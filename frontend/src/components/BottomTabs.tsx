import { NavLink } from 'react-router-dom'
import { useHome } from '../api/queries'

const tabs = [
  { to: '/', icon: '🏠', label: '홈', end: true },
  { to: '/all', icon: '📦', label: '전체', end: false },
  { to: '/history', icon: '🕑', label: '이력', end: false },
  { to: '/me', icon: '👤', label: '내정보', end: false },
]

/** 하단 탭바. 홈 탭에 곧만료 배지 표시. */
export function BottomTabs() {
  const { data: home } = useHome()
  const expiring = home?.expiringSoonCount ?? 0

  return (
    <nav className="sticky bottom-0 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center py-2 pb-2.5 text-[10px] ${
              isActive ? 'font-bold text-brand' : 'text-ink-soft'
            }`
          }
        >
          <span className="mb-0.5 text-xl">{t.icon}</span>
          {t.label}
          {t.to === '/' && expiring > 0 && (
            <span className="absolute top-1 right-[calc(50%-22px)] flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-surface bg-danger px-1 text-[9px] font-bold text-white">
              {expiring}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
