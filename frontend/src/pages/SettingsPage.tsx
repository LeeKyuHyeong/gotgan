import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useMe, useUpdateMe } from '../api/queries'
import { clearAuth, getHouseholdId, setHouseholdId, skipSilentLogin } from '../lib/auth'
import { disablePush, enablePush, getPushSubscription, isIos, isStandalone } from '../lib/push'
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

  // 곧만료 푸시 알림 (기기 단위 구독)
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushErr, setPushErr] = useState<string | null>(null)
  useEffect(() => {
    getPushSubscription().then((s) => setPushOn(!!s)).catch(() => {})
  }, [])

  if (isLoading || !me) return <LoadingScreen />

  async function togglePush() {
    setPushErr(null)
    setPushBusy(true)
    try {
      if (pushOn) {
        await disablePush()
        setPushOn(false)
      } else {
        await enablePush()
        setPushOn(true)
      }
    } catch (e) {
      setPushErr(e instanceof Error ? e.message : '알림 설정에 실패했어요.')
    } finally {
      setPushBusy(false)
    }
  }

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
    // 가구 스코프 쿼리는 키에 householdId 가 들어가 새 가구는 새 캐시 버킷으로 자동 재조회된다.
    // 여기서 전체 invalidate 하면 옛 가구 키가 새 헤더로 재조회돼 캐시가 오염되므로 하지 않는다.
    navigate('/')
  }

  function logout() {
    clearAuth()
    skipSilentLogin() // 명시적 로그아웃 — 로그인 화면이 자동 재로그인하지 않게
    qc.clear() // (FE-2) 다음 계정 로그인 시 이전 계정 캐시가 비치지 않게 전부 비움
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
        <div className="mb-2 text-xs font-bold text-ink-soft">알림</div>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-center gap-3 p-3.5">
            <span className="text-lg">⏰</span>
            <div className="flex-1">
              <div className="text-sm font-semibold">유통기한 임박 알림</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">
                매일 아침 9시, 3일 내 만료 예정 알림 (이 기기로)
                {isIos() && !isStandalone() && (
                  <>
                    <br />
                    아이폰: Safari 공유 → &quot;홈 화면에 추가&quot; 후 그 앱에서 켜기
                  </>
                )}
              </div>
            </div>
            {/* 미지원 환경에서도 비활성화하지 않음 — 눌렀을 때 enablePush 가 이유를 메시지로 던짐 */}
            <button
              onClick={togglePush}
              disabled={pushBusy}
              aria-checked={pushOn}
              aria-label="유통기한 임박 알림"
              role="switch"
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${pushOn ? 'bg-brand' : 'bg-line'}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${pushOn ? 'left-6' : 'left-1'}`}
              />
            </button>
          </div>
          {pushErr && (
            <div className="border-t border-line px-3.5 py-2">
              <ErrorText message={pushErr} />
            </div>
          )}
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
