import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useDeleteHousehold,
  useHousehold,
  useKickMember,
  useLeaveHousehold,
  useRenameHousehold,
  useTransferOwnership,
} from '../api/queries'
import { AppHeader, ErrorText, LoadingScreen, Pill } from '../components/ui'
import { clearHouseholdId, getHouseholdId } from '../lib/auth'
import { errorMessage } from '../api/client'

export default function HouseholdManagePage() {
  const { id } = useParams()
  const householdId = Number(id)
  const navigate = useNavigate()

  const { data: hh, isLoading } = useHousehold(householdId)
  const rename = useRenameHousehold(householdId)
  const kick = useKickMember(householdId)
  const transfer = useTransferOwnership(householdId)
  const leave = useLeaveHousehold(householdId)
  const del = useDeleteHousehold(householdId)

  const [name, setName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (isLoading || !hh) return <LoadingScreen />

  const isOwner = hh.myRole === 'OWNER'

  function openRename() {
    setName(hh!.name)
    setErr(null)
    setEditingName(true)
  }
  function saveName() {
    setErr(null)
    if (!name.trim()) return setErr('가구 이름을 입력하세요.')
    rename.mutate({ name: name.trim() }, { onSuccess: () => setEditingName(false), onError: (e) => setErr(errorMessage(e)) })
  }

  function doKick(userId: number, nickname: string | null) {
    if (!confirm(`'${nickname ?? '이 멤버'}'님을 내보낼까요?`)) return
    setErr(null)
    kick.mutate(userId, { onError: (e) => setErr(errorMessage(e)) })
  }

  function doTransfer(userId: number, nickname: string | null) {
    if (!confirm(`'${nickname ?? '이 멤버'}'님에게 가족장을 넘길까요? 이후 본인은 일반 멤버가 됩니다.`)) return
    setErr(null)
    transfer.mutate(userId, { onError: (e) => setErr(errorMessage(e)) })
  }

  /** 현재 보고 있던 가구를 떠난/삭제한 경우 컨텍스트 정리 후 홈으로(가드가 재라우팅). */
  function afterRemoval() {
    if (getHouseholdId() === householdId) clearHouseholdId()
    navigate('/', { replace: true })
  }

  function doLeave() {
    if (!confirm('이 가구에서 나갈까요?')) return
    setErr(null)
    leave.mutate(undefined, { onSuccess: afterRemoval, onError: (e) => setErr(errorMessage(e)) })
  }

  function doDelete() {
    if (!confirm(`'${hh!.name}' 가구를 삭제할까요?\n아이템·이력이 모두 사라지며 되돌릴 수 없습니다.`)) return
    setErr(null)
    del.mutate(undefined, { onSuccess: afterRemoval, onError: (e) => setErr(errorMessage(e)) })
  }

  const inputCls =
    'w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand'

  return (
    <div className="min-h-screen pb-10">
      <AppHeader title="가구 관리" back />

      <div className="px-5">
        {/* 이름 */}
        <div className="mb-2 mt-1 text-xs font-bold text-ink-soft">가구 이름</div>
        {editingName ? (
          <div className="flex gap-2">
            <input className={inputCls} value={name} maxLength={50} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveName()} />
            <button onClick={saveName} disabled={rename.isPending} className="shrink-0 rounded-xl bg-brand px-3 text-sm font-bold text-white disabled:opacity-50">저장</button>
            <button onClick={() => setEditingName(false)} className="shrink-0 rounded-xl border border-line px-3 text-sm font-semibold text-ink-soft">취소</button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-3.5">
            <span className="text-base font-semibold">{hh.name}</span>
            {isOwner && (
              <button onClick={openRename} className="ml-auto text-xs font-semibold text-brand">이름 변경</button>
            )}
          </div>
        )}

        {/* 멤버 */}
        <div className="mb-2 mt-5 flex items-center justify-between">
          <span className="text-xs font-bold text-ink-soft">멤버 {hh.memberCount}/{hh.maxMembers}</span>
          {isOwner && hh.inviteCode && (
            <button onClick={() => navigate(`/households/${householdId}/invite`)} className="text-xs font-semibold text-brand">＋ 초대 ({hh.inviteCode})</button>
          )}
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {hh.members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2 border-b border-line p-3.5 last:border-none">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
                {(m.nickname ?? '?').slice(0, 1)}
              </span>
              <span className="text-sm font-semibold">{m.nickname ?? '이름없음'}</span>
              {m.role === 'OWNER' && <Pill tone="brand">가족장</Pill>}
              {isOwner && m.role !== 'OWNER' && (
                <span className="ml-auto flex items-center gap-2.5 text-xs">
                  <button onClick={() => doTransfer(m.userId, m.nickname)} disabled={transfer.isPending} className="font-semibold text-ink-soft">가족장 넘기기</button>
                  <button onClick={() => doKick(m.userId, m.nickname)} disabled={kick.isPending} className="font-semibold text-danger">내보내기</button>
                </span>
              )}
            </div>
          ))}
        </div>

        <ErrorText message={err} />

        {/* 위험 영역 */}
        <div className="mt-8">
          {isOwner ? (
            <button onClick={doDelete} disabled={del.isPending} className="w-full rounded-2xl border border-danger/30 py-3.5 text-sm font-semibold text-danger disabled:opacity-50">
              가구 삭제
            </button>
          ) : (
            <button onClick={doLeave} disabled={leave.isPending} className="w-full rounded-2xl border border-danger/30 py-3.5 text-sm font-semibold text-danger disabled:opacity-50">
              가구 나가기
            </button>
          )}
          <p className="mt-2 text-center text-[12px] text-ink-soft">
            {isOwner
              ? '삭제하면 아이템·이력이 모두 사라지며 되돌릴 수 없어요. 가족장을 넘기면 가구는 유지돼요.'
              : '나가면 이 가구의 재고를 더 이상 볼 수 없어요.'}
          </p>
        </div>
      </div>
    </div>
  )
}
