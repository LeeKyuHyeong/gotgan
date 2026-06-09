import { useState } from 'react'
import type { InventoryProduct } from '../api/types'
import { tintBg } from '../lib/colors'
import { ExpiryBadge } from './ui'
import { StockRow } from './StockRow'

/** 합산 품목행. 묶음 1개면 그 묶음 행을 바로 노출(품목행에서 +/-), 여러 개면 펼침 토글. */
export function InventoryProductRow({ product }: { product: InventoryProduct }) {
  const [open, setOpen] = useState(false)

  // 단일 묶음: 묶음 행 그대로(이름=품목명, 위치 표시 불필요)
  if (product.batches.length === 1) {
    return <StockRow stock={product.batches[0]} />
  }

  return (
    <div className="border-b border-line last:border-none">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 py-3 text-left"
      >
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ backgroundColor: tintBg(product.categoryColor) }}
        >
          {product.categoryEmoji ?? '📦'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{product.name}</span>
            <ExpiryBadge dDay={product.minDDay} />
          </div>
          <div className="mt-0.5 text-xs text-ink-soft">{product.batches.length}곳 · 펼쳐서 조절</div>
        </div>
        <span className="text-sm font-bold tabular-nums">
          {Number(product.totalQuantity)}
          {product.unit && <span className="ml-0.5 text-xs font-medium text-ink-soft">{product.unit}</span>}
        </span>
        <span className={`text-ink-soft transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>

      {open && (
        <div className="pl-6">
          {product.batches.map((b) => (
            <StockRow key={b.id} stock={b} showLocation />
          ))}
        </div>
      )}
    </div>
  )
}
