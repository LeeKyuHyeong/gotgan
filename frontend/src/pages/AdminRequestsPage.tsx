import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useAdminRequests,
  useAdminStats,
  useApproveRequest,
  useRejectRequest,
} from '../api/queries'
import { AppHeader, Button, ErrorText, LoadingScreen, Pill } from '../components/ui'
import { CATEGORY_EMOJIS } from '../lib/emojis'
import { CATEGORY_COLORS } from '../lib/colors'
import { errorMessage } from '../api/client'

export default function AdminRequestsPage() {
  const navigate = useNavigate()
  const { data: stats } = useAdminStats()
  const { data: requests, isLoading } = useAdminRequests('PENDING')
  const approve = useApproveRequest()
  const reject = useRejectRequest()

  // 카드별 선택 이모지·색상 / 이모지 그리드 열림 상태
  const [emojiById, setEmojiById] = useState<Record<number, string | null>>({})
  const [colorById, setColorById] = useState<Record<number, string | null>>({})
  const [openGrid, setOpenGrid] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  if (isLoading) return <LoadingScreen />

  function emojiFor(id: number, fallback: string | null) {
    return id in emojiById ? emojiById[id] : fallback
  }

  function doApprove(id: number, name: string, emoji: string | null) {
    setErr(null)
    approve.mutate(
      { id, body: { name, emoji, color: colorById[id] ?? '' } },
      { onError: (e) => setErr(errorMessage(e)) },
    )
  }

  function doReject(id: number) {
    if (!confirm('이 요청을 반려할까요?')) return
    setErr(null)
    reject.mutate(id, { onError: (e) => setErr(errorMessage(e)) })
  }

  const pending = requests ?? []

  return (
    <div className="min-h-screen pb-10">
      <AppHeader
        title="🖥 어드민"
        right={
          <button
            onClick={() => navigate('/admin/categories')}
            className="text-xs font-semibold text-brand"
          >
            공통 분류 ›
          </button>
        }
      />

      <div className="px-5">
        {/* 통계 */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { v: stats?.pendingRequests ?? 0, k: '대기 요청' },
            { v: stats?.totalCategories ?? 0, k: '공통 분류' },
            { v: stats?.totalHouseholds ?? 0, k: '전체 가구' },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl border border-line bg-surface py-3 text-center">
              <div className="text-xl font-bold">{s.v}</div>
              <div className="text-[11px] text-ink-soft">{s.k}</div>
            </div>
          ))}
        </div>

        <div className="mb-2.5 text-xs font-bold text-ink-soft">대기 중인 분류 추가 요청</div>

        {pending.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-soft">대기 중인 요청이 없어요.</p>
        )}

        <div className="space-y-3">
          {pending.map((r) => {
            const emoji = emojiFor(r.id, r.suggestedEmoji)
            const busy = approve.isPending || reject.isPending
            return (
              <div key={r.id} className="rounded-2xl border border-line bg-surface p-3.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOpenGrid((o) => (o === r.id ? null : r.id))}
                    className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-lg"
                  >
                    {emoji ?? '🆕'} <span className="text-xs text-ink-soft">⌄</span>
                  </button>
                  <span className="font-semibold">{r.requestedName}</span>
                  {r.sameNameCount > 1 && <Pill tone="brand">{r.sameNameCount}건 요청</Pill>}
                </div>

                {openGrid === r.id && (
                  <>
                    <div className="mt-2.5 grid grid-cols-8 gap-1.5">
                      {CATEGORY_EMOJIS.map((em) => (
                        <button
                          key={em}
                          onClick={() => setEmojiById((m) => ({ ...m, [r.id]: em }))}
                          className={`flex aspect-square items-center justify-center rounded-lg text-xl ${
                            emoji === em ? 'bg-brand-soft ring-2 ring-brand' : 'bg-bg'
                          }`}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setColorById((m) => ({ ...m, [r.id]: null }))}
                        className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] text-ink-soft ${
                          (colorById[r.id] ?? null) == null ? 'border-brand ring-2 ring-brand' : 'border-line'
                        }`}
                        aria-label="색 없음"
                      >
                        ✕
                      </button>
                      {CATEGORY_COLORS.map((cl) => (
                        <button
                          key={cl}
                          onClick={() => setColorById((m) => ({ ...m, [r.id]: cl }))}
                          style={{ backgroundColor: cl }}
                          className={`h-6 w-6 rounded-full ${colorById[r.id] === cl ? 'ring-2 ring-offset-1 ring-ink' : ''}`}
                          aria-label={cl}
                        />
                      ))}
                    </div>
                  </>
                )}

                <div className="mt-2 text-[12px] text-ink-soft">
                  요청 {r.requesterNickname ?? '알 수 없음'}
                  {r.householdName ? ` · ${r.householdName}` : ''} · {r.createdAt.slice(0, 10)}
                </div>

                <div className="mt-3 flex gap-2">
                  <Button onClick={() => doApprove(r.id, r.requestedName, emoji)} disabled={busy}>
                    승인 (공통 추가)
                  </Button>
                  <Button variant="ghost" onClick={() => doReject(r.id)} disabled={busy}>
                    반려
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <ErrorText message={err} />
      </div>
    </div>
  )
}
