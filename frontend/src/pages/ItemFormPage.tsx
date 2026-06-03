import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  useCategories,
  useCreateItem,
  useDeleteItem,
  useItem,
  useItemHistory,
  useLocations,
  useUpdateItem,
} from '../api/queries'
import { AppHeader, Button, ErrorText, LoadingScreen } from '../components/ui'
import CategoryPicker from '../components/CategoryPicker'
import { ACTION_LABEL, fmtDateTime } from '../lib/history'
import { errorMessage } from '../api/client'

export default function ItemFormPage() {
  const { id } = useParams()
  const editing = !!id
  const itemId = Number(id)
  const navigate = useNavigate()
  const [search] = useSearchParams()

  const { data: locations } = useLocations()
  const { data: categories } = useCategories()
  const { data: item, isLoading: itemLoading } = useItem(editing ? itemId : 0)
  const { data: history } = useItemHistory(editing ? itemId : 0)
  const create = useCreateItem()
  const update = useUpdateItem(itemId)
  const del = useDeleteItem()

  const [name, setName] = useState('')
  const [locationId, setLocationId] = useState<number | ''>('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [memo, setMemo] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  // 편집: 기존 값 채우기
  useEffect(() => {
    if (item) {
      setName(item.name)
      setLocationId(item.locationId)
      setCategoryId(item.categoryId ?? '')
      setQuantity(String(item.quantity))
      setUnit(item.unit ?? '')
      setExpiryDate(item.expiryDate ?? '')
      setMemo(item.memo ?? '')
    }
  }, [item])

  // 생성: 기본 위치(쿼리파라미터 또는 첫 위치)
  useEffect(() => {
    if (!editing && locationId === '' && locations && locations.length > 0) {
      const fromQuery = Number(search.get('locationId'))
      setLocationId(fromQuery || locations[0].id)
    }
  }, [editing, locations, search, locationId])

  if (editing && itemLoading) return <LoadingScreen />

  const selectedCategory =
    categoryId === '' ? null : categories?.find((c) => c.id === categoryId) ?? null

  function submit() {
    setErr(null)
    if (!name.trim()) return setErr('이름을 입력하세요.')
    if (locationId === '') return setErr('위치를 선택하세요.')
    const body = {
      name: name.trim(),
      locationId: Number(locationId),
      categoryId: categoryId === '' ? null : Number(categoryId),
      quantity: Number(quantity) || 0,
      unit: unit.trim() || null,
      expiryDate: expiryDate || null,
      memo: memo.trim() || null,
    }
    const opts = {
      onSuccess: () => navigate(-1),
      onError: (e: unknown) => setErr(errorMessage(e)),
    }
    if (editing) update.mutate(body, opts)
    else create.mutate(body, opts)
  }

  function remove() {
    if (!confirm('이 아이템을 삭제할까요?')) return
    del.mutate(itemId, { onSuccess: () => navigate('/'), onError: (e) => setErr(errorMessage(e)) })
  }

  const inputCls =
    'w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand'
  const labelCls = 'mb-1.5 block text-[13px] font-semibold text-ink-soft'

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title={editing ? '아이템 편집' : '아이템 추가'} back />
      <div className="flex-1 space-y-4 px-5 pt-2">
        <div>
          <label className={labelCls}>이름</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>위치</label>
          <select
            className={inputCls}
            value={locationId}
            onChange={(e) => setLocationId(Number(e.target.value))}
          >
            {locations?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.emoji} {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelCls}>수량</label>
            <input
              className={inputCls}
              type="number"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className={labelCls}>단위</label>
            <input
              className={inputCls}
              value={unit}
              placeholder="팩, 개, 통…"
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelCls}>분류</label>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={`${inputCls} flex items-center justify-between text-left`}
            >
              <span className={`flex items-center gap-1.5 ${selectedCategory ? '' : 'text-ink-soft'}`}>
                {selectedCategory?.color && (
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedCategory.color }} />
                )}
                {selectedCategory ? `${selectedCategory.emoji ?? ''} ${selectedCategory.name}` : '미분류'}
              </span>
              <span className="text-ink-soft">›</span>
            </button>
          </div>
          <div className="flex-1">
            <label className={labelCls}>유통기한</label>
            <input
              className={inputCls}
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>메모</label>
          <input className={inputCls} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
        <ErrorText message={err} />

        {editing && (
          <div>
            <label className={labelCls}>변동 이력</label>
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              {!history ? (
                <p className="p-4 text-center text-xs text-ink-soft">불러오는 중…</p>
              ) : history.length === 0 ? (
                <p className="p-4 text-center text-xs text-ink-soft">아직 이력이 없어요.</p>
              ) : (
                history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-none"
                  >
                    <span className="min-w-9 text-[13px] font-bold text-brand">{ACTION_LABEL[h.action]}</span>
                    <span className="truncate text-xs text-ink-soft">{h.userNickname ?? '누군가'}</span>
                    <span className="ml-auto whitespace-nowrap text-right">
                      {h.delta != null && (
                        <span className="text-[13px] font-semibold tabular-nums">
                          {h.delta > 0 ? '+' : ''}
                          {Number(h.delta)}
                          {h.quantityAfter != null && (
                            <span className="font-normal text-ink-soft"> → {Number(h.quantityAfter)}</span>
                          )}
                        </span>
                      )}
                      <span className="block text-[11px] text-ink-soft">{fmtDateTime(h.createdAt)}</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2 px-5 pb-8">
        <Button onClick={submit} disabled={create.isPending || update.isPending}>
          {editing ? '저장' : '추가하기'}
        </Button>
        {editing && (
          <Button variant="danger" onClick={remove} disabled={del.isPending}>
            삭제
          </Button>
        )}
      </div>

      {pickerOpen && (
        <CategoryPicker
          value={categoryId === '' ? null : categoryId}
          onChange={(id) => setCategoryId(id ?? '')}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
