import { useMemo, useState } from 'react'
import {
  useAdminCategories,
  useAdminCreateCategory,
  useAdminDeleteCategory,
  useAdminUpdateCategory,
} from '../api/queries'
import { AppHeader, Button, ErrorText, LoadingScreen, Pill } from '../components/ui'
import { CATEGORY_EMOJIS } from '../lib/emojis'
import { CATEGORY_COLORS, tintBg } from '../lib/colors'
import { errorMessage } from '../api/client'
import type { AdminCategoryResponse } from '../api/types'

type EditTarget = 'new' | AdminCategoryResponse | null

export default function AdminCategoriesPage() {
  const { data: categories, isLoading } = useAdminCategories()
  const create = useAdminCreateCategory()
  const update = useAdminUpdateCategory()
  const del = useAdminDeleteCategory()

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<EditTarget>(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState<string | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = categories ?? []
    return term ? list.filter((c) => c.name.toLowerCase().includes(term)) : list
  }, [categories, q])

  if (isLoading) return <LoadingScreen />

  function openNew() {
    setEditing('new')
    setName('')
    setEmoji(null)
    setColor(null)
    setSortOrder('')
    setErr(null)
  }

  function openEdit(c: AdminCategoryResponse) {
    setEditing(c)
    setName(c.name)
    setEmoji(c.emoji)
    setColor(c.color)
    setSortOrder(String(c.sortOrder))
    setErr(null)
  }

  function close() {
    setEditing(null)
    setErr(null)
  }

  function save() {
    setErr(null)
    if (!name.trim()) return setErr('분류 이름을 입력하세요.')
    const order = sortOrder.trim() === '' ? null : Number(sortOrder)
    const opts = { onSuccess: close, onError: (e: unknown) => setErr(errorMessage(e)) }
    // color: '' 로 보내면 색 제거(백엔드가 빈값→null 처리)
    if (editing === 'new') {
      create.mutate({ name: name.trim(), emoji, color: color ?? '', sortOrder: order }, opts)
    } else if (editing) {
      update.mutate({ id: editing.id, body: { name: name.trim(), emoji, color: color ?? '', sortOrder: order } }, opts)
    }
  }

  function toggleHidden(c: AdminCategoryResponse) {
    update.mutate({
      id: c.id,
      body: { status: c.status === 'ACTIVE' ? 'HIDDEN' : 'ACTIVE' },
    })
  }

  function remove(c: AdminCategoryResponse) {
    if (!confirm(`'${c.name}' 분류를 삭제할까요?`)) return
    setErr(null)
    del.mutate(c.id, { onError: (e) => setErr(errorMessage(e)) })
  }

  const inputCls =
    'w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand'

  return (
    <div className="min-h-screen pb-10">
      <AppHeader
        title="공통 분류"
        back
        right={
          <button onClick={openNew} className="text-sm font-semibold text-brand">
            ＋추가
          </button>
        }
      />

      <div className="px-5">
        {editing !== null && (
          <div className="mb-4 rounded-2xl border border-brand/40 bg-surface p-3.5">
            <div className="mb-2 text-[13px] font-semibold text-ink-soft">
              {editing === 'new' ? '새 공통 분류' : `'${editing.name}' 수정`}
            </div>
            <input
              className={inputCls}
              placeholder="분류 이름"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="my-2.5 grid grid-cols-8 gap-1.5">
              {CATEGORY_EMOJIS.map((em) => (
                <button
                  key={em}
                  onClick={() => setEmoji((p) => (p === em ? null : em))}
                  className={`flex aspect-square items-center justify-center rounded-lg text-xl ${
                    emoji === em ? 'bg-brand-soft ring-2 ring-brand' : 'bg-bg'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
            <div className="mb-2.5">
              <div className="mb-1.5 text-[12px] font-semibold text-ink-soft">색상</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setColor(null)}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] text-ink-soft ${
                    color == null ? 'border-brand ring-2 ring-brand' : 'border-line'
                  }`}
                  aria-label="색 없음"
                >
                  ✕
                </button>
                {CATEGORY_COLORS.map((cl) => (
                  <button
                    key={cl}
                    onClick={() => setColor(cl)}
                    style={{ backgroundColor: cl }}
                    className={`h-7 w-7 rounded-full ${color === cl ? 'ring-2 ring-offset-2 ring-ink' : ''}`}
                    aria-label={cl}
                  />
                ))}
              </div>
            </div>
            <input
              className={inputCls}
              type="number"
              inputMode="numeric"
              placeholder="정렬 순서 (숫자, 비우면 맨 뒤)"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
            <ErrorText message={err} />
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" onClick={close}>
                취소
              </Button>
              <Button onClick={save} disabled={create.isPending || update.isPending}>
                저장
              </Button>
            </div>
          </div>
        )}

        <input
          className={inputCls}
          placeholder="🔍 분류 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2.5 border-b border-line p-3.5 last:border-none"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg text-lg"
                style={{ backgroundColor: tintBg(c.color) }}
              >
                {c.emoji ?? '📦'}
              </span>
              <span className={`font-semibold ${c.status === 'HIDDEN' ? 'text-ink-soft line-through' : ''}`}>
                {c.name}
              </span>
              {c.status === 'HIDDEN' && <Pill tone="muted">숨김</Pill>}
              <span className="ml-auto flex items-center gap-2.5 text-xs">
                <button onClick={() => toggleHidden(c)} className="font-semibold text-ink-soft">
                  {c.status === 'ACTIVE' ? '숨김' : '표시'}
                </button>
                <button onClick={() => openEdit(c)} className="font-semibold text-brand">
                  수정
                </button>
                <button onClick={() => remove(c)} className="font-semibold text-danger">
                  삭제
                </button>
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="p-6 text-center text-sm text-ink-soft">분류가 없어요.</p>
          )}
        </div>

        {editing === null && <ErrorText message={err} />}

        <p className="mt-3 text-center text-[12px] text-ink-soft">
          여기서 승인·수정·순서변경한 분류가 모든 가구의 '분류 선택'에 공통으로 노출됩니다.
        </p>
      </div>
    </div>
  )
}
