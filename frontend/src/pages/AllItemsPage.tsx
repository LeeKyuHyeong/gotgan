import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInventory } from '../api/queries'
import type { InventoryGroup, InventoryProduct } from '../api/types'
import { Fab, LoadingScreen, ExpiryBadge } from '../components/ui'
import { InventoryProductRow } from '../components/InventoryProductRow'
import { PullToRefresh } from '../components/PullToRefresh'

type Node =
  | { kind: 'group'; minDDay: number | null; group: InventoryGroup }
  | { kind: 'product'; minDDay: number | null; product: InventoryProduct }

export default function AllItemsPage() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const { data, isLoading, refetch } = useInventory(q.trim() || undefined)
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({})

  // 그룹 + 단독 품목을 minDDay(NULL 뒤) 임박순으로 병합
  const nodes = useMemo<Node[]>(() => {
    if (!data) return []
    const list: Node[] = [
      ...data.groups.map((g) => ({ kind: 'group' as const, minDDay: g.minDDay, group: g })),
      ...data.ungrouped.map((p) => ({ kind: 'product' as const, minDDay: p.minDDay, product: p })),
    ]
    return list.sort((a, b) => {
      if (a.minDDay == null) return b.minDDay == null ? 0 : 1
      if (b.minDDay == null) return -1
      return a.minDDay - b.minDDay
    })
  }, [data])

  const count = nodes.length

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
              placeholder="품목 검색 (예: 우유, 맥주)"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </header>

        {isLoading || !data ? (
          <LoadingScreen />
        ) : count === 0 ? (
          <p className="mt-16 text-center text-sm text-ink-soft">
            {q.trim() ? '검색 결과가 없어요.' : '아직 재고가 없어요.'}
          </p>
        ) : (
          <>
            <p className="mb-1 mt-1 text-xs text-ink-soft">{count}개 · 유통기한 임박순</p>
            {nodes.map((n) =>
              n.kind === 'product' ? (
                <InventoryProductRow key={`p${n.product.productId}`} product={n.product} />
              ) : (
                <GroupBlock
                  key={`g${n.group.groupId}`}
                  group={n.group}
                  open={!!openGroups[n.group.groupId]}
                  onToggle={() =>
                    setOpenGroups((o) => ({ ...o, [n.group.groupId]: !o[n.group.groupId] }))
                  }
                />
              ),
            )}
          </>
        )}

        <Fab onClick={() => navigate('/stock/new')} />
      </div>
    </PullToRefresh>
  )
}

function GroupBlock({
  group,
  open,
  onToggle,
}: {
  group: InventoryGroup
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-line last:border-none">
      <button onClick={onToggle} className="flex w-full items-center gap-3 py-3 text-left">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-line/50 text-lg">
          🧺
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-bold">{group.groupName}</span>
            <ExpiryBadge dDay={group.minDDay} />
          </div>
          <div className="mt-0.5 text-xs text-ink-soft">{group.products.length}종 · 묶음</div>
        </div>
        <span className="text-sm font-bold tabular-nums">{Number(group.totalQuantity)}</span>
        <span className={`text-ink-soft transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && (
        <div className="pl-6">
          {group.products.map((p) => (
            <InventoryProductRow key={p.productId} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
