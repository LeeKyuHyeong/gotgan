import { useNavigate } from 'react-router-dom'
import type { ItemResponse } from '../api/types'
import { useAdjustItem } from '../api/queries'
import { tintBg } from '../lib/colors'
import { ExpiryBadge, Pill } from './ui'

/** 아이템 한 줄. showLocation=true 면 위치 뱃지 노출(전체 화면). */
export function ItemRow({ item, showLocation }: { item: ItemResponse; showLocation?: boolean }) {
  const navigate = useNavigate()
  const adjust = useAdjustItem()

  const sub = item.expiryDate
    ? `~${item.expiryDate.slice(5).replace('-', '/')}`
    : '기한 없음'

  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-none">
      <button
        onClick={() => navigate(`/items/${item.id}/edit`)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ backgroundColor: tintBg(item.categoryColor) }}
        >
          {item.categoryEmoji ?? '📦'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{item.name}</span>
            <ExpiryBadge dDay={item.dDay} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            {showLocation && (
              <Pill tone="brand">
                {item.locationEmoji} {item.locationName}
              </Pill>
            )}
            {item.categoryName && !showLocation && <span>{item.categoryName}</span>}
            <span>{sub}</span>
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => adjust.mutate({ itemId: item.id, delta: -1 })}
          disabled={item.quantity <= 0}
          className="h-7 w-7 rounded-full border border-line text-ink-soft disabled:opacity-40"
          aria-label="감소"
        >
          −
        </button>
        <span className="min-w-9 text-center text-sm font-bold tabular-nums">
          {Number(item.quantity)}
          {item.unit && <span className="ml-0.5 text-xs font-medium text-ink-soft">{item.unit}</span>}
        </span>
        <button
          onClick={() => adjust.mutate({ itemId: item.id, delta: 1 })}
          className="h-7 w-7 rounded-full border border-line text-ink-soft active:bg-line/40"
          aria-label="증가"
        >
          +
        </button>
      </div>
    </div>
  )
}
