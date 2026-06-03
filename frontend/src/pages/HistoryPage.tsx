import { useState } from 'react'
import { useHistory } from '../api/queries'
import { LoadingScreen } from '../components/ui'
import { PullToRefresh } from '../components/PullToRefresh'
import { ACTION_LABEL, fmtDateTime as fmt } from '../lib/history'

export default function HistoryPage() {
  const [page, setPage] = useState(0)
  const { data, isLoading, refetch } = useHistory(page)

  return (
    <PullToRefresh onRefresh={refetch}>
    <div className="min-h-screen px-5 pb-6">
      <header className="sticky top-0 z-10 bg-bg/90 pt-4 pb-2 backdrop-blur">
        <h1 className="text-xl font-bold tracking-tight">변동 이력</h1>
      </header>

      {isLoading || !data ? (
        <LoadingScreen />
      ) : data.content.length === 0 ? (
        <p className="mt-16 text-center text-sm text-ink-soft">아직 이력이 없어요.</p>
      ) : (
        <>
          {data.content.map((h) => (
            <div key={h.id} className="flex items-center gap-3 border-b border-line py-3 last:border-none">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{h.itemName}</div>
                <div className="mt-0.5 text-xs text-ink-soft">
                  {h.userNickname ?? '누군가'} · {fmt(h.createdAt)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[13px] font-bold text-brand">{ACTION_LABEL[h.action]}</div>
                {h.delta != null && (
                  <div className="text-xs text-ink-soft tabular-nums">
                    {h.delta > 0 ? '+' : ''}
                    {Number(h.delta)}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="mt-4 flex justify-between text-sm">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 text-ink-soft disabled:opacity-30"
            >
              ‹ 이전
            </button>
            <span className="text-xs text-ink-soft">{page + 1} / {Math.max(1, data.totalPages)}</span>
            <button
              disabled={!data.hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-ink-soft disabled:opacity-30"
            >
              다음 ›
            </button>
          </div>
        </>
      )}
    </div>
    </PullToRefresh>
  )
}
