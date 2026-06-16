import { useMemo, useState } from 'react'
import { useCategories, useCategoryRequests, useCreateCategoryRequest } from '../api/queries'
import { errorMessage } from '../api/client'
import { CATEGORY_EMOJIS as EMOJIS } from '../lib/emojis'
import { useModalDialog } from '../lib/useModalDialog'
import { Button, ErrorText, Pill } from './ui'

interface Props {
  value: number | null
  onChange: (categoryId: number | null) => void
  onClose: () => void
}

/** 시안 ⑩ 분류 선택 — 공통 분류 칩 + "＋ 분류 추가 요청하기". 폼 상태 보존을 위해 오버레이로 동작. */
export default function CategoryPicker({ value, onChange, onClose }: Props) {
  const { data: categories } = useCategories()
  const { data: requests } = useCategoryRequests()
  const createRequest = useCreateCategoryRequest()

  const [q, setQ] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [reqName, setReqName] = useState('')
  const [reqEmoji, setReqEmoji] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const dialogRef = useModalDialog<HTMLDivElement>(onClose)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return categories ?? []
    return (categories ?? []).filter((c) => c.name.toLowerCase().includes(term))
  }, [categories, q])

  const pending = (requests ?? []).filter((r) => r.status === 'PENDING')

  function pick(id: number | null) {
    onChange(id)
    onClose()
  }

  function openRequest() {
    setReqName(q.trim())
    setReqEmoji(null)
    setErr(null)
    setDone(null)
    setRequesting(true)
  }

  function submitRequest() {
    setErr(null)
    if (!reqName.trim()) return setErr('분류 이름을 입력하세요.')
    createRequest.mutate(
      { name: reqName.trim(), emoji: reqEmoji },
      {
        onSuccess: () => {
          setDone(`'${reqName.trim()}' 추가 요청을 보냈어요. 운영자 검토 후 반영돼요.`)
          setRequesting(false)
          setReqName('')
          setReqEmoji(null)
        },
        onError: (e) => setErr(errorMessage(e)),
      },
    )
  }

  const chip = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-semibold ${
      on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink'
    }`

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/30" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="분류 선택"
        tabIndex={-1}
        className="flex max-h-screen w-full max-w-[480px] flex-col bg-bg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-center gap-3 bg-bg/90 px-4 pt-4 pb-2 backdrop-blur">
          <button onClick={onClose} className="text-2xl leading-none text-ink-soft" aria-label="닫기">
            ‹
          </button>
          <h1 className="text-xl font-bold tracking-tight">분류 선택</h1>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pt-2">
          <input
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand"
            placeholder="🔍 분류 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <button className={chip(value === null)} onClick={() => pick(null)}>
              미분류
            </button>
            {filtered.map((c) => (
              <button key={c.id} className={chip(value === c.id)} onClick={() => pick(c.id)}>
                {c.color && (
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                )}
                <span>{c.emoji}</span> {c.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="py-4 text-center text-sm text-ink-soft">검색 결과가 없어요.</p>
            )}
          </div>

          {pending.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-[13px] font-semibold text-ink-soft">요청 중인 분류</div>
              <div className="flex flex-wrap gap-2">
                {pending.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line bg-surface px-3 py-2 text-[13px] text-ink-soft"
                  >
                    <span>{r.suggestedEmoji ?? '🆕'}</span> {r.requestedName}
                    <Pill tone="muted">승인대기</Pill>
                  </span>
                ))}
              </div>
            </div>
          )}

          {done && (
            <p className="mt-5 rounded-xl bg-brand-soft px-3.5 py-3 text-center text-[13px] font-medium text-brand">
              {done}
            </p>
          )}
        </div>

        <div className="border-t border-line px-5 pb-8 pt-4">
          {requesting ? (
            <div className="space-y-3">
              <p className="text-center text-[13px] font-semibold text-ink-soft">새 분류 추가 요청</p>
              <input
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand"
                placeholder="분류 이름 (예: 반려동물)"
                value={reqName}
                maxLength={40}
                onChange={(e) => setReqName(e.target.value)}
              />
              <div className="grid grid-cols-8 gap-1.5">
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    onClick={() => setReqEmoji((prev) => (prev === em ? null : em))}
                    className={`flex aspect-square items-center justify-center rounded-lg text-xl ${
                      reqEmoji === em ? 'bg-brand-soft ring-2 ring-brand' : 'bg-surface'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <ErrorText message={err} />
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setRequesting(false)}>
                  취소
                </Button>
                <Button onClick={submitRequest} disabled={createRequest.isPending}>
                  요청 보내기
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-2 text-center text-[13px] text-ink-soft">원하는 분류가 없나요?</p>
              <Button variant="ghost" onClick={openRequest}>
                ＋ 분류 추가 요청하기
              </Button>
              <p className="mt-2 text-center text-[12px] text-ink-soft">
                요청은 운영자 검토 후 공통 목록에 반영돼요
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
