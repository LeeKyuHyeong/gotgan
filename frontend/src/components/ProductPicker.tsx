import { useState } from 'react'
import { useProducts } from '../api/queries'
import type { ProductPickerResponse } from '../api/types'
import { useModalDialog } from '../lib/useModalDialog'

interface Props {
  onPick: (product: ProductPickerResponse) => void
  onClose: () => void
}

/** 재고 있는 기존 품목 선택. 폼 상태 보존 위해 오버레이로 동작. */
export default function ProductPicker({ onPick, onClose }: Props) {
  const [q, setQ] = useState('')
  const { data: products } = useProducts(q.trim() || undefined)
  const dialogRef = useModalDialog<HTMLDivElement>(onClose)

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/30" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="품목 선택"
        tabIndex={-1}
        className="flex max-h-screen w-full max-w-[480px] flex-col bg-bg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-center gap-3 bg-bg/90 px-4 pt-4 pb-2 backdrop-blur">
          <button onClick={onClose} className="text-2xl leading-none text-ink-soft" aria-label="닫기">
            ‹
          </button>
          <h1 className="text-xl font-bold tracking-tight">품목 선택</h1>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-8">
          <input
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand"
            placeholder="🔍 품목 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="mt-4 flex flex-col">
            {(products ?? []).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onPick(p)
                  onClose()
                }}
                className="flex items-center justify-between border-b border-line py-3 text-left last:border-none"
              >
                <span className="text-[15px] font-semibold">{p.name}</span>
                <span className="text-xs text-ink-soft">
                  {p.groupName && <span className="mr-2">🧺 {p.groupName}</span>}
                  {p.unit}
                </span>
              </button>
            ))}
            {products && products.length === 0 && (
              <p className="py-8 text-center text-sm text-ink-soft">
                재고 있는 품목이 없어요. 닫고 "새 품목"으로 추가하세요.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
