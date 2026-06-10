import { useNavigate } from 'react-router-dom'
import type { StockResponse } from '../api/types'
import { useAdjustStock } from '../api/queries'
import { tintBg } from '../lib/colors'
import { ExpiryBadge, Pill } from './ui'

/** 재고 묶음 한 줄. showLocation=true 면 위치 뱃지(합산 트리 펼침/전체에서). 탭→묶음 편집. */
export function StockRow({ stock, showLocation }: { stock: StockResponse; showLocation?: boolean }) {
  const navigate = useNavigate()
  const adjust = useAdjustStock()

  const sub = stock.expiryDate ? `~${stock.expiryDate.slice(5).replace('-', '/')}` : '기한 없음'

  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-none">
      <button
        onClick={() => navigate(`/stock/${stock.id}/edit`)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ backgroundColor: tintBg(stock.categoryColor) }}
        >
          {stock.categoryEmoji ?? '📦'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{stock.productName}</span>
            <ExpiryBadge dDay={stock.dDay} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            {showLocation && (
              <Pill tone="brand">
                {stock.locationEmoji} {stock.locationName}
              </Pill>
            )}
            <span>{sub}</span>
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => adjust.mutate({ stockId: stock.id, delta: -1 })}
          disabled={stock.quantity <= 0}
          className="h-7 w-7 rounded-full border border-line text-ink-soft disabled:opacity-40"
          aria-label="감소"
        >
          −
        </button>
        <span className="min-w-9 text-center text-sm font-bold tabular-nums">
          {Number(stock.quantity)}
          {stock.unit && <span className="ml-0.5 text-xs font-medium text-ink-soft">{stock.unit}</span>}
        </span>
        <button
          onClick={() => adjust.mutate({ stockId: stock.id, delta: 1 })}
          className="h-7 w-7 rounded-full border border-line text-ink-soft active:bg-line/40"
          aria-label="증가"
        >
          +
        </button>
      </div>
    </div>
  )
}
