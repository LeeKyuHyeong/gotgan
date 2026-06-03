import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useCreateLocation,
  useDeleteLocation,
  useLocations,
  useUpdateLocation,
} from '../api/queries'
import { AppHeader, Button, ErrorText, LoadingScreen } from '../components/ui'
import { errorMessage } from '../api/client'

const EMOJIS = [
  '🏠', '🛏', '🛋', '🚿', '🚽', '🧊',
  '🍳', '🗄', '🧺', '🧴', '🧹', '🧰',
  '📦', '🚪', '🪑', '🧯', '🐾', '💊',
  '💄', '👕', '🧸', '🔧', '🍶', '🧂',
]

export default function LocationFormPage() {
  const { id } = useParams()
  const editing = !!id
  const locationId = Number(id)
  const navigate = useNavigate()

  const { data: locations, isLoading } = useLocations()
  const create = useCreateLocation()
  const update = useUpdateLocation(locationId)
  const del = useDeleteLocation()

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState<string>('📦')
  const [sortOrder, setSortOrder] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // 편집: 기존 값 채우기 (단일 조회 API 없이 목록에서 찾음)
  useEffect(() => {
    if (editing && locations) {
      const loc = locations.find((l) => l.id === locationId)
      if (loc) {
        setName(loc.name)
        setEmoji(loc.emoji ?? '📦')
        setSortOrder(loc.sortOrder)
      }
    }
  }, [editing, locations, locationId])

  if (editing && isLoading) return <LoadingScreen />

  function submit() {
    setErr(null)
    if (!name.trim()) return setErr('위치 이름을 입력하세요.')
    const opts = {
      onSuccess: () => navigate('/locations', { replace: true }),
      onError: (e: unknown) => setErr(errorMessage(e)),
    }
    if (editing) {
      update.mutate({ name: name.trim(), emoji, sortOrder }, opts)
    } else {
      create.mutate({ name: name.trim(), emoji }, opts)
    }
  }

  function remove() {
    if (!confirm('이 위치를 삭제할까요?')) return
    del.mutate(locationId, {
      onSuccess: () => navigate('/locations', { replace: true }),
      onError: (e) => setErr(errorMessage(e)),
    })
  }

  const inputCls =
    'w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand'
  const labelCls = 'mb-1.5 block text-[13px] font-semibold text-ink-soft'

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title={editing ? '위치 편집' : '위치 추가'} back />
      <div className="flex-1 space-y-4 px-5 pt-2">
        <div>
          <label className={labelCls}>위치 이름</label>
          <input
            className={inputCls}
            value={name}
            placeholder="예) 큰방, 냉장고, 화장실"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>아이콘 (이모지)</label>
          <div className="grid grid-cols-6 gap-2">
            {EMOJIS.map((em) => (
              <button
                key={em}
                onClick={() => setEmoji(em)}
                className={`flex aspect-square items-center justify-center rounded-xl border text-2xl ${
                  emoji === em ? 'border-2 border-brand bg-brand-soft' : 'border-line bg-surface'
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        {editing && (
          <div>
            <label className={labelCls}>표시 순서 (작을수록 위)</label>
            <input
              className={inputCls}
              type="number"
              value={sortOrder ?? 0}
              onChange={(e) => setSortOrder(Number(e.target.value))}
            />
          </div>
        )}

        <ErrorText message={err} />
      </div>

      <div className="space-y-2 px-5 pb-8">
        <Button onClick={submit} disabled={create.isPending || update.isPending}>
          {editing ? '저장' : '추가하기'}
        </Button>
        {editing && (
          <Button variant="danger" onClick={remove} disabled={del.isPending}>
            이 위치 삭제
          </Button>
        )}
      </div>
    </div>
  )
}
