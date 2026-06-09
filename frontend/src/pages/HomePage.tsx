import { useNavigate } from 'react-router-dom'
import { useHome, useMe } from '../api/queries'
import { getHouseholdId } from '../lib/auth'
import { Fab, LoadingScreen, Pill } from '../components/ui'
import { PullToRefresh } from '../components/PullToRefresh'

export default function HomePage() {
  const navigate = useNavigate()
  const { data: home, isLoading, refetch } = useHome()
  const { data: me } = useMe()
  const hid = getHouseholdId()
  const householdName = me?.households.find((h) => h.householdId === hid)?.name ?? '우리집'

  if (isLoading || !home) return <LoadingScreen />

  return (
    <PullToRefresh onRefresh={refetch}>
    <div className="relative min-h-screen px-5 pb-24">
      <header className="sticky top-0 z-10 bg-bg/90 pt-4 pb-3 backdrop-blur">
        <h1 className="text-xl font-bold tracking-tight">{householdName}</h1>
      </header>

      {home.expiringSoonCount > 0 && (
        <button
          onClick={() => navigate('/all')}
          className="mb-3.5 flex w-full items-center gap-2.5 rounded-2xl border border-warn/30 bg-warn-soft px-3.5 py-3 text-left"
        >
          <span className="text-xl">⏰</span>
          <span>
            <span className="block text-[13px] font-bold text-warn">
              곧 만료 {home.expiringSoonCount}개
            </span>
            <span className="block text-[11px] text-ink-soft">D-3 이내 · 눌러서 확인</span>
          </span>
          <span className="ml-auto text-lg text-warn">›</span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* 전체 보기 */}
        <button
          onClick={() => navigate('/all')}
          className="col-span-2 flex items-center justify-between rounded-2xl bg-brand px-4 py-3.5 text-white"
        >
          <span>
            <span className="block text-[15px] font-bold">📦 전체 보기</span>
            <span className="block text-xs text-white/85">아이템 {home.totalItemCount}개 · 검색</span>
          </span>
          <span className="text-xl">›</span>
        </button>

        {home.locations.map((l) => (
          <button
            key={l.id}
            onClick={() => navigate(`/locations/${l.id}`)}
            className="relative flex min-h-26 flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4 text-left"
          >
            {l.expiringSoonCount > 0 && (
              <span className="absolute top-3 right-3">
                <Pill tone="warn">곧 만료 {l.expiringSoonCount}</Pill>
              </span>
            )}
            <span className="text-2xl">{l.emoji ?? '📦'}</span>
            <span className="text-[15px] font-bold">{l.name}</span>
            <span className="text-xs text-ink-soft">{l.itemCount}개</span>
          </button>
        ))}
      </div>

      <Fab onClick={() => navigate('/stock/new')} label="재고 추가" />
    </div>
    </PullToRefresh>
  )
}
