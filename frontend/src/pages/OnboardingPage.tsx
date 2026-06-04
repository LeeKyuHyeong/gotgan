import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMe, useUpdateMe } from '../api/queries'
import { AppHeader, Button, ErrorText, LoadErrorScreen, LoadingScreen } from '../components/ui'
import { errorMessage } from '../api/client'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { data: me, isLoading, isError, refetch } = useMe()
  const updateMe = useUpdateMe()
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)

  if (isLoading) return <LoadingScreen />
  if (isError || !me) return <LoadErrorScreen onRetry={() => refetch()} />

  // 이미 가구가 있으면 온보딩에 머무를 이유가 없음 — stale 캐시로 잘못 들어와도 홈으로 복귀.
  if (!me.needsOnboarding) return <Navigate to="/" replace />

  const hasName = !!me.user.nickname?.trim()

  function saveName() {
    setErr(null)
    if (!name.trim()) return setErr('표시 이름을 입력하세요.')
    updateMe.mutate({ nickname: name.trim() }, { onError: (e) => setErr(errorMessage(e)) })
  }

  // 카카오 닉네임이 없으면(동의 안 함/미설정) 먼저 표시 이름부터 받는다.
  if (!hasName) {
    return (
      <div className="min-h-screen">
        <AppHeader title="표시 이름" />
        <div className="px-5 pt-2">
          <p className="mb-5 text-sm leading-relaxed text-ink-soft">
            가구에서 보여질 <b className="text-ink">표시 이름</b>을 정해주세요.
            <br />
            변동 이력과 멤버 목록에 표시돼요.
          </p>
          <input
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand"
            placeholder="예: 현규"
            value={name}
            maxLength={50}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
          />
          <ErrorText message={err} />
          <div className="mt-4">
            <Button onClick={saveName} disabled={updateMe.isPending}>
              다음
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <AppHeader title="가구 설정" />
      <div className="px-5 pt-2">
        <p className="mb-5 text-sm leading-relaxed text-ink-soft">
          반가워요, <b className="text-ink">{me.user.nickname}</b>님!
          <br />
          어떻게 시작할까요?
        </p>

        <button
          onClick={() => navigate('/onboarding/create')}
          className="mb-3.5 flex w-full items-center gap-3.5 rounded-2xl border-2 border-brand bg-brand-soft p-4 text-left"
        >
          <span className="text-3xl">🏡</span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold">새 가구 만들기</span>
            <span className="mt-0.5 block text-xs leading-snug text-ink-soft">
              우리집을 새로 등록하고 같이 쓸 사람을 초대해요
            </span>
          </span>
          <span className="text-lg text-ink-soft">›</span>
        </button>

        <button
          onClick={() => navigate('/onboarding/join')}
          className="flex w-full items-center gap-3.5 rounded-2xl border border-line bg-surface p-4 text-left"
        >
          <span className="text-3xl">🔑</span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold">초대코드로 합류</span>
            <span className="mt-0.5 block text-xs leading-snug text-ink-soft">
              받은 코드를 입력해 기존 가구에 들어가요
            </span>
          </span>
          <span className="text-lg text-ink-soft">›</span>
        </button>

        <button
          onClick={() => setName(me.user.nickname ?? '')}
          className="mt-5 w-full text-center text-xs text-ink-soft underline"
        >
          표시 이름 다시 정하기
        </button>
        {name !== '' && (
          <div className="mt-2">
            <input
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand"
              value={name}
              maxLength={50}
              onChange={(e) => setName(e.target.value)}
            />
            <ErrorText message={err} />
            <div className="mt-2">
              <Button onClick={saveName} disabled={updateMe.isPending}>
                저장
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
