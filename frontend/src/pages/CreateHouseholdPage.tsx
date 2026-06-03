import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateHousehold } from '../api/queries'
import { AppHeader, Button, ErrorText } from '../components/ui'
import { errorMessage } from '../api/client'

export default function CreateHouseholdPage() {
  const navigate = useNavigate()
  const create = useCreateHousehold()
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)

  function submit() {
    setErr(null)
    if (!name.trim()) {
      setErr('가구 이름을 입력하세요.')
      return
    }
    create.mutate(
      { name: name.trim() },
      {
        onSuccess: (h) => navigate(`/households/${h.id}/invite`, { replace: true }),
        onError: (e) => setErr(errorMessage(e)),
      },
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="새 가구 만들기" back />
      <div className="flex-1 px-5 pt-2">
        <p className="mb-5 text-sm leading-relaxed text-ink-soft">
          우리집을 뭐라고 부를까요?
          <br />
          나중에 바꿀 수 있어요.
        </p>
        <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">가구 이름</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예) OO네 집, 신혼집, 우리집"
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-3.5 text-[15px] outline-none focus:border-brand"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <p className="mt-2 text-[11px] text-ink-soft">
          큰방·화장실·냉장고·거실 기본 위치가 자동으로 만들어져요.
        </p>
        <ErrorText message={err} />
      </div>
      <div className="px-5 pb-8">
        <Button onClick={submit} disabled={create.isPending}>
          만들고 시작하기
        </Button>
      </div>
    </div>
  )
}
