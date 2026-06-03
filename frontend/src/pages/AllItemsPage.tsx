import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useItems } from '../api/queries'
import { Fab, LoadingScreen } from '../components/ui'
import { ItemRow } from '../components/ItemRow'
import { PullToRefresh } from '../components/PullToRefresh'

export default function AllItemsPage() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const { data: items, isLoading, refetch } = useItems(q.trim() ? { q: q.trim() } : undefined)

  return (
    <PullToRefresh onRefresh={refetch}>
    <div className="min-h-screen px-5 pb-24">
      <header className="sticky top-0 z-10 bg-bg/90 pt-4 pb-2 backdrop-blur">
        <h1 className="mb-3 text-xl font-bold tracking-tight">전체 재고</h1>
        <div className="flex items-center gap-2 rounded-xl bg-line/50 px-3.5 py-2.5">
          <span className="text-ink-soft">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="아이템 검색 (예: 우유, 휴지)"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      </header>

      {isLoading || !items ? (
        <LoadingScreen />
      ) : items.length === 0 ? (
        <p className="mt-16 text-center text-sm text-ink-soft">
          {q.trim() ? '검색 결과가 없어요.' : '아직 아이템이 없어요.'}
        </p>
      ) : (
        <>
          <p className="mb-1 mt-1 text-xs text-ink-soft">{items.length}개 · 유통기한 임박순</p>
          {items.map((it) => (
            <ItemRow key={it.id} item={it} showLocation />
          ))}
        </>
      )}

      <Fab onClick={() => navigate('/items/new')} />
    </div>
    </PullToRefresh>
  )
}
