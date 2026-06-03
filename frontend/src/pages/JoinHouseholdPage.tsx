import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJoinHousehold } from '../api/queries'
import { AppHeader, Button, ErrorText } from '../components/ui'
import { errorMessage } from '../api/client'

export default function JoinHouseholdPage() {
  const navigate = useNavigate()
  const join = useJoinHousehold()
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)

  function submit() {
    setErr(null)
    if (!code.trim()) {
      setErr('초대코드를 입력하세요.')
      return
    }
    join.mutate(
      { inviteCode: code.trim().toUpperCase() },
      {
        onSuccess: () => navigate('/', { replace: true }),
        onError: (e) => setErr(errorMessage(e)),
      },
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="초대코드로 합류" back />
      <div className="flex-1 px-5 pt-2">
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
        <Button onClick={submit} disabled={join.isPending}>
          이 가구에 합류하기
        </Button>
      </div>
    </div>
  )
}
