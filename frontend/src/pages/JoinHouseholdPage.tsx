import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJoinHousehold, useMe, useUpdateMe } from '../api/queries'
import { clearPendingInviteCode, getPendingInviteCode } from '../lib/auth'
import { needsDisplayName, planJoin } from '../lib/household'
import { AppHeader, Button, ErrorText, LoadingScreen } from '../components/ui'
import { errorMessage } from '../api/client'

export default function JoinHouseholdPage() {
  const navigate = useNavigate()
  const { data: me, isLoading } = useMe()
  const join = useJoinHousehold()
  const updateMe = useUpdateMe()
  // 초대 링크로 들어왔다면 보관된 코드를 자동 입력
  const [code, setCode] = useState(() => getPendingInviteCode() ?? '')
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)

  // 보관 코드는 1회용 — 화면에 옮긴 뒤 비워서 다음 로그인에 영향 없게
  useEffect(() => clearPendingInviteCode(), [])

  // 닉네임 유무로 이름 단계 노출이 정해지므로 me 로딩까진 대기
  if (isLoading || !me) return <LoadingScreen />

  // 초대 흐름은 온보딩의 표시이름 단계를 건너뛰므로, 닉네임이 없으면 여기서 먼저 받는다.
  const needsName = needsDisplayName(me.user.nickname)
  const pending = join.isPending || updateMe.isPending

  function submit() {
    setErr(null)
    const plan = planJoin({ needsName, name, code })
    if (plan.error) {
      setErr(plan.error)
      return
    }
    const runJoin = () =>
      join.mutate(
        { inviteCode: plan.inviteCode! },
        {
          onSuccess: () => navigate('/', { replace: true }),
          onError: (e) => setErr(errorMessage(e)),
        },
      )
    if (plan.saveName != null) {
      // 합류 전에 표시 이름부터 저장 — 빈 이름으로 가구에 들어가지 않게
      updateMe.mutate(
        { nickname: plan.saveName },
        { onSuccess: runJoin, onError: (e) => setErr(errorMessage(e)) },
      )
    } else {
      runJoin()
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="초대코드로 합류" back />
      <div className="flex-1 px-5 pt-2">
        {needsName && (
          <div className="mb-5">
            <p className="mb-2 text-sm leading-relaxed text-ink-soft">
              가구에서 보여질 <b className="text-ink">표시 이름</b>을 먼저 정해주세요.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 현규"
              maxLength={50}
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand"
            />
          </div>
        )}
        <p className="mb-5 text-sm leading-relaxed text-ink-soft">받은 6자리 코드를 입력하세요.</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="예) K7M3PQ"
          maxLength={8}
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-3.5 text-center text-xl font-bold tracking-[0.3em] outline-none focus:border-brand"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <ErrorText message={err} />
      </div>
      <div className="px-5 pb-8">
        <Button onClick={submit} disabled={pending}>
          이 가구에 합류하기
        </Button>
      </div>
    </div>
  )
}
