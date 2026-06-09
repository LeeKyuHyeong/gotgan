import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useDeleteStock,
  useLocations,
  useStock,
  useStockHistory,
  useUpdateStock,
} from '../api/queries'
import { AppHeader, Button, ErrorText, LoadingScreen } from '../components/ui'
import { ACTION_LABEL, fmtDateTime } from '../lib/history'
import { errorMessage } from '../api/client'

const inputCls =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand'
const labelCls = 'mb-1.5 block text-[13px] font-semibold text-ink-soft'

export default function StockEditPage() {
  const { id } = useParams()
  const stockId = Number(id)
  const navigate = useNavigate()
  const { data: locations } = useLocations()
  const { data: stock, isLoading } = useStock(stockId)
  const { data: history } = useStockHistory(stockId)
  const update = useUpdateStock(stockId)
  const del = useDeleteStock()

  const [locationId, setLocationId] = useState<number | ''>('')
  const [quantity, setQuantity] = useState('1')
  const [expiryDate, setExpiryDate] = useState('')
  const [memo, setMemo] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (stock) {
      setLocationId(stock.locationId)
      setQuantity(String(stock.quantity))
      setExpiryDate(stock.expiryDate ?? '')
      setMemo(stock.memo ?? '')
    }
  }, [stock])

  if (isLoading || !stock) return <LoadingScreen />

  function submit() {
    setErr(null)
    if (locationId === '') return setErr('위치를 선택하세요.')
    const qty = Number(quantity)
    if (qty < 0) return setErr('수량은 0보다 작을 수 없어요.')
    update.mutate(
      { quantity: qty, expiryDate: expiryDate || null, memo: memo.trim() || null, locationId: Number(locationId) },
      { onSuccess: () => navigate(-1), onError: (e) => setErr(errorMessage(e)) },
    )
  }

  function remove() {
    if (!confirm('이 재고를 삭제할까요?')) return
    del.mutate(stockId, { onSuccess: () => navigate(-1), onError: (e) => setErr(errorMessage(e)) })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="재고 편집" back />
      <div className="flex-1 space-y-4 px-5 pt-2">
        <div>
          <label className={labelCls}>품목</label>
          <div className={`${inputCls} flex items-center justify-between bg-line/30`}>
            <span className="font-semibold">
              {stock.productName}
              {stock.unit && <span className="ml-1 text-ink-soft">({stock.unit})</span>}
            </span>
            <span className="text-[11px] text-ink-soft">품목 정보는 수정할 수 없어요</span>
          </div>
        </div>
        <div>
          <label className={labelCls}>위치</label>
          <select className={inputCls} value={locationId} onChange={(e) => setLocationId(Number(e.target.value))}>
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
      </div>

      <div className="space-y-2 px-5 pb-8">
        <Button onClick={submit} disabled={update.isPending}>
          저장
        </Button>
        <Button variant="danger" onClick={remove} disabled={del.isPending}>
          삭제
        </Button>
      </div>
    </div>
  )
}
