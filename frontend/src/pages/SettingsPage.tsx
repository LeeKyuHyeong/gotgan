import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useMe, useUpdateMe } from '../api/queries'
import { clearAuth, getHouseholdId, setHouseholdId } from '../lib/auth'
import { errorMessage } from '../api/client'
import { ErrorText, LoadingScreen, Pill } from '../components/ui'

export default function SettingsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: me, isLoading } = useMe()
  const updateMe = useUpdateMe()
  const currentHid = getHouseholdId()

  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')
  const [nameErr, setNameErr] = useState<string | null>(null)

  if (isLoading || !me) return <LoadingScreen />

  function openNameEdit() {
    setName(me?.user.nickname ?? '')
    setNameErr(null)
    setEditingName(true)
  }

  function saveName() {
    setNameErr(null)
    if (!name.trim()) return setNameErr('표시 이름을 입력하세요.')
    updateMe.mutate(
      { nickname: name.trim() },
      { onSuccess: () => setEditingName(false), onError: (e) => setNameErr(errorMessage(e)) },
    )
  }

  function switchHousehold(hid: number) {
    if (hid === currentHid) return
    setHouseholdId(hid)
    qc.invalidateQueries()
    navigate('/')
  }

  function logout() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen px-5 pb-6">
      <header className="sticky top-0 z-10 bg-bg/90 pt-4 pb-2 backdrop-blur">
        <h1 className="text-xl font-bold tracking-tight">내정보</h1>
      </header>

      <div className="flex items-center gap-3 py-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
          {(me.user.nickname ?? '?').slice(0, 1)}
        </span>
        {editingName ? (
          <div className="flex-1">
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-[15px] outline-none focus:border-brand"
                value={name}
                maxLength={50}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
              />
              <button
                onClick={saveName}
                disabled={updateMe.isPending}
                className="rounded-xl bg-brand px-3 text-sm font-bold text-white disabled:opacity-50"
              >
                저장
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="rounded-xl border border-line px-3 text-sm font-semibold text-ink-soft"
              >
                취소
              </button>
            </div>
            <ErrorText message={nameErr} />
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-2">
            <div>
              <div className="text-base font-semibold">{me.user.nickname ?? '이름없음'}</div>
              {me.user.role === 'SYSTEM_ADMIN' && <div className="text-xs text-ink-soft">운영자</div>}
            </div>
            <button onClick={openNameEdit} className="ml-auto text-xs font-semibold text-brand">
              이름 수정
            </button>
          </div>
        )}
      </div>

      <div className="mt-2">
        <div className="mb-2 text-xs font-bold text-ink-soft">내 가구</div>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {me.households.map((h) => (
            <div key={h.householdId} className="flex items-center gap-2 border-b border-line p-3.5 last:border-none">
              <button onClick={() => switchHousehold(h.householdId)} className="flex flex-1 items-center gap-2 text-left">
                <span className="text-sm font-semibold">{h.name}</span>
                {h.householdId === currentHid && <Pill tone="brand">현재</Pill>}
                {h.myRole === 'OWNER' && <Pill tone="muted">가족장</Pill>}
              </button>
              <button
                onClick={() => navigate(`/households/${h.householdId}/manage`)}
                className="text-xs font-semibold text-brand"
              >
                관리
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-xs font-bold text-ink-soft">관리</div>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <button
            onClick={() => navigate('/locations')}
            className="flex w-full items-center gap-3 border-b border-line p-3.5 text-left last:border-none"
          >
            <span className="text-lg">📍</span>
            <span className="flex-1 text-sm font-semibold">위치 관리</span>
            <span className="text-lg text-ink-soft">›</span>
          </button>
          {me.user.role === 'SYSTEM_ADMIN' && (
            <button
              onClick={() => navigate('/admin')}
              className="flex w-full items-center gap-3 border-b border-line p-3.5 text-left last:border-none"
            >
              <span className="text-lg">🖥</span>
              <span className="flex-1 text-sm font-semibold">어드민 (운영자)</span>
              <span className="text-lg text-ink-soft">›</span>
            </button>
          )}
        </div>
      </div>

      <button
        onClick={logout}
        className="mt-5 w-full rounded-2xl border border-line bg-surface py-3.5 text-sm font-semibold text-ink-soft"
      >
        로그아웃
      </button>
    </div>
  )
}
