import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useInvite, useRegenerateInvite } from '../api/queries'
import { AppHeader, Button, LoadingScreen } from '../components/ui'
import { inviteJoinUrl, shareInviteKakao } from '../lib/kakao'

export default function InvitePage() {
  const { id } = useParams()
  const householdId = Number(id)
  const navigate = useNavigate()
  const { data, isLoading } = useInvite(householdId)
  const regen = useRegenerateInvite(householdId)
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  if (isLoading || !data) return <LoadingScreen />

  const code = data.inviteCode

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }

  function copy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function share() {
    // 1순위 카카오톡 → 2순위 OS 공유 시트 → 3순위 복사
    if (await shareInviteKakao(code)) return
    const text = `🏠 곳간에 초대합니다!\n초대코드: ${code}\n${inviteJoinUrl(code)}\n링크를 열면 바로 합류할 수 있어요.`
    if (navigator.share) {
      try {
        await navigator.share({ title: '곳간 초대', text })
        return
      } catch {
        return // 사용자가 공유 시트를 닫음
      }
    }
    await navigator.clipboard.writeText(text)
    flash('초대 메시지를 복사했어요')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="같이 쓸 사람 초대" />
      <div className="flex-1 px-5 pt-2">
        <p className="mb-3.5 text-sm leading-relaxed text-ink-soft">
          이 코드를 알려주면 합류할 수 있어요.
        </p>

        <div className="rounded-2xl border border-dashed border-brand bg-brand-soft p-5 text-center">
          <div className="mb-2 text-xs font-semibold text-brand">초대코드</div>
          <div className="text-3xl font-extrabold tracking-[0.25em] tabular-nums">{data.inviteCode}</div>
          <button onClick={copy} className="mt-2.5 text-xs font-semibold text-brand">
            {copied ? '✓ 복사됨' : '📋 코드 복사'}
          </button>
        </div>

        <button
          onClick={share}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FEE500] py-3.5 text-sm font-bold text-[#191600] active:opacity-90"
        >
          💬 카카오톡으로 초대하기
        </button>

        <button
          onClick={() => regen.mutate()}
          disabled={regen.isPending}
          className="mt-3 w-full text-center text-xs font-semibold text-ink-soft underline disabled:opacity-50"
        >
          코드 재발급
        </button>

        <div className="mt-6">
          <div className="mb-2 text-[13px] font-bold">
            현재 멤버 <span className="font-normal text-ink-soft">{data.memberCount} / {data.maxMembers}명</span>
          </div>
          {data.members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2.5 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                {(m.nickname ?? '?').slice(0, 1)}
              </span>
              <span className="text-sm font-semibold">{m.nickname ?? '이름없음'}</span>
              <span className="ml-auto text-[11px] text-ink-soft">
                {m.role === 'OWNER' ? '가족장' : '멤버'}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="px-5 pb-8">
        <Button variant="ghost" onClick={() => navigate('/', { replace: true })}>
          홈으로
        </Button>
      </div>

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-5">
          <div className="rounded-full bg-ink/90 px-4 py-2 text-xs font-semibold text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}
