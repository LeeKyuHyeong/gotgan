import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useCategories,
  useCreateStock,
  useLocations,
  useProductGroups,
} from '../api/queries'
import type { CreateStockRequest, ProductPickerResponse } from '../api/types'
import { AppHeader, Button, ErrorText } from '../components/ui'
import CategoryPicker from '../components/CategoryPicker'
import PresetPicker from '../components/PresetPicker'
import ProductPicker from '../components/ProductPicker'
import { suggestPresets, type ItemPreset } from '../lib/presets'
import { errorMessage } from '../api/client'

const inputCls =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand'
const labelCls = 'mb-1.5 block text-[13px] font-semibold text-ink-soft'

export default function StockAddPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const { data: locations } = useLocations()
  const { data: categories } = useCategories()
  const { data: groups } = useProductGroups()
  const create = useCreateStock()

  // 품목 모드: 'existing'(기존 선택) | 'new'(새 품목)
  const [mode, setMode] = useState<'existing' | 'new'>('new')
  const [picked, setPicked] = useState<ProductPickerResponse | null>(null)

  // 새 품목 필드
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [groupName, setGroupName] = useState('')

  // 공통 묶음 필드
  const [locationId, setLocationId] = useState<number | ''>('')
  const [quantity, setQuantity] = useState('1')
  const [expiryDate, setExpiryDate] = useState('')
  const [memo, setMemo] = useState('')

  const [err, setErr] = useState<string | null>(null)
  const [catOpen, setCatOpen] = useState(false)
  const [presetOpen, setPresetOpen] = useState(false)
  const [productOpen, setProductOpen] = useState(false)

  // 기본 위치(쿼리파라미터 또는 첫 위치)
  useEffect(() => {
    if (locationId === '' && locations && locations.length > 0) {
      const fromQuery = Number(search.get('locationId'))
      setLocationId(fromQuery || locations[0].id)
    }
  }, [locations, search, locationId])

  const selectedCategory =
    categoryId === '' ? null : categories?.find((c) => c.id === categoryId) ?? null
  const suggestions = useMemo(() => suggestPresets(name), [name])

  function applyPreset(p: ItemPreset) {
    setName(p.name)
    const cat = categories?.find((c) => c.name === p.category)
    if (cat) setCategoryId(cat.id)
    if (p.unit && !unit.trim()) setUnit(p.unit)
  }

  function submit() {
    setErr(null)
    if (locationId === '') return setErr('위치를 선택하세요.')
    const qty = Number(quantity)
    if (!qty || qty <= 0) return setErr('수량은 0보다 커야 해요.')

    let productPart: Pick<CreateStockRequest, 'productId' | 'newProduct'>
    if (mode === 'existing') {
      if (!picked) return setErr('품목을 선택하세요.')
      productPart = { productId: picked.id }
    } else {
      if (!name.trim()) return setErr('품목 이름을 입력하세요.')
      // 그룹: 입력값이 기존 그룹 이름과 일치하면 groupId, 아니면 groupName(신규)
      const g = groupName.trim()
      const existing = groups?.find((x) => x.name === g)
      productPart = {
        newProduct: {
          name: name.trim(),
          unit: unit.trim() || null,
          categoryId: categoryId === '' ? null : Number(categoryId),
          groupId: existing ? existing.id : null,
          groupName: !existing && g ? g : null,
        },
      }
    }

    const body: CreateStockRequest = {
      ...productPart,
      locationId: Number(locationId),
      quantity: qty,
      expiryDate: expiryDate || null,
      memo: memo.trim() || null,
    }
    create.mutate(body, {
      onSuccess: () => navigate(-1),
      onError: (e) => setErr(errorMessage(e)),
    })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="재고 추가" back />
      <div className="flex-1 space-y-4 px-5 pt-2">
        {/* 품목 모드 토글 */}
        <div className="flex rounded-xl border border-line p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`flex-1 rounded-lg py-2 ${mode === 'existing' ? 'bg-brand text-white' : 'text-ink-soft'}`}
          >
            기존 품목
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`flex-1 rounded-lg py-2 ${mode === 'new' ? 'bg-brand text-white' : 'text-ink-soft'}`}
          >
            새 품목
          </button>
        </div>

        {mode === 'existing' ? (
          <div>
            <label className={labelCls}>품목</label>
            <button
              type="button"
              onClick={() => setProductOpen(true)}
              className={`${inputCls} flex items-center justify-between text-left`}
            >
              <span className={picked ? '' : 'text-ink-soft'}>
                {picked ? `${picked.name}${picked.unit ? ` (${picked.unit})` : ''}` : '품목 선택'}
              </span>
              <span className="text-ink-soft">›</span>
            </button>
          </div>
        ) : (
          <>
            <div>
              <div className="mb-1.5 flex items-end justify-between">
                <label className="text-[13px] font-semibold text-ink-soft">품목 이름</label>
                <button
                  type="button"
                  onClick={() => setPresetOpen(true)}
                  className="text-[13px] font-semibold text-brand"
                >
                  자주 쓰는 품목 ›
                </button>
              </div>
              <input
                className={inputCls}
                value={name}
                placeholder="직접 입력하거나 자주 쓰는 품목에서 선택"
                onChange={(e) => setName(e.target.value)}
              />
              {suggestions.length > 0 && (
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                  {suggestions.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink"
                    >
                      <span>{p.emoji}</span> {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelCls}>단위</label>
                <input
                  className={inputCls}
                  value={unit}
                  placeholder="팩, 개, 통…"
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className={labelCls}>분류</label>
                <button
                  type="button"
                  onClick={() => setCatOpen(true)}
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
            </div>
            <div>
              <label className={labelCls}>그룹 (선택 — 캔/병처럼 합산해 보고 싶을 때)</label>
              <input
                className={inputCls}
                value={groupName}
                placeholder="예: 맥주"
                list="group-options"
                onChange={(e) => setGroupName(e.target.value)}
              />
              <datalist id="group-options">
                {groups?.map((g) => <option key={g.id} value={g.name} />)}
              </datalist>
            </div>
          </>
        )}

        {/* 공통 묶음 필드 */}
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
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className={labelCls}>유통기한</label>
            <input
              className={inputCls}
              type="date"
              min={new Date().toLocaleDateString('sv-SE')}
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
      </div>

      <div className="sticky bottom-0 border-t border-line bg-bg/90 px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <Button onClick={submit} disabled={create.isPending}>
          추가하기
        </Button>
      </div>

      {catOpen && (
        <CategoryPicker
          value={categoryId === '' ? null : categoryId}
          onChange={(id) => setCategoryId(id ?? '')}
          onClose={() => setCatOpen(false)}
        />
      )}
      {presetOpen && <PresetPicker onPick={applyPreset} onClose={() => setPresetOpen(false)} />}
      {productOpen && (
        <ProductPicker onPick={setPicked} onClose={() => setProductOpen(false)} />
      )}
    </div>
  )
}
