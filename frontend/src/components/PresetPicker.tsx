import { useMemo, useState } from 'react'
import { useCategories } from '../api/queries'
import { groupPresets, ITEM_PRESETS, type ItemPreset } from '../lib/presets'
import { useModalDialog } from '../lib/useModalDialog'

interface Props {
  onPick: (preset: ItemPreset) => void
  onClose: () => void
}

/** 자주 쓰는 품목 선택 — 분류별 그룹 칩. 폼 상태 보존을 위해 오버레이로 동작(CategoryPicker와 동일 패턴). */
export default function PresetPicker({ onPick, onClose }: Props) {
  const { data: categories } = useCategories()
  const [q, setQ] = useState('')
  const dialogRef = useModalDialog<HTMLDivElement>(onClose)

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = term
      ? ITEM_PRESETS.filter(
          (p) => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term),
        )
      : ITEM_PRESETS
    return groupPresets(list)
  }, [q])

  // 분류 이모지는 실제 공통 분류 데이터에서 (프리셋 카탈로그와 시드 이름 일치)
  const categoryEmoji = (name: string) => categories?.find((c) => c.name === name)?.emoji ?? ''

  function pick(p: ItemPreset) {
    onPick(p)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/30" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="자주 쓰는 품목"
        tabIndex={-1}
        className="flex max-h-screen w-full max-w-[480px] flex-col bg-bg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-center gap-3 bg-bg/90 px-4 pt-4 pb-2 backdrop-blur">
          <button onClick={onClose} className="text-2xl leading-none text-ink-soft" aria-label="닫기">
            ‹
          </button>
          <h1 className="text-xl font-bold tracking-tight">자주 쓰는 품목</h1>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-8">
          <input
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand"
            placeholder="🔍 품목 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {groups.map((g) => (
            <div key={g.category} className="mt-5">
              <div className="mb-2 text-[13px] font-semibold text-ink-soft">
                {categoryEmoji(g.category)} {g.category}
              </div>
              <div className="flex flex-wrap gap-2">
                {g.items.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => pick(p)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink"
                  >
                    <span>{p.emoji}</span> {p.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-soft">
              검색 결과가 없어요. 닫고 이름을 직접 입력하세요.
            </p>
          )}

          <p className="mt-6 text-center text-[12px] text-ink-soft">
            선택하면 이름·분류·단위가 채워져요 — 물론 직접 입력해도 돼요
          </p>
        </div>
      </div>
    </div>
  )
}
