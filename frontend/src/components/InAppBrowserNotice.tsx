import { useState } from 'react'
import {
  canOpenExternal,
  copyLink,
  dismissInAppNotice,
  inAppBrowserName,
  isInAppBrowser,
  isInAppNoticeDismissed,
  isIos,
  isStandalone,
  openExternal,
} from '../lib/install'
import { Button } from './ui'

/** 카카오톡 등 인앱 브라우저로 들어왔을 때 "기본 브라우저로 열어주세요" 전체 안내.
 *  인앱 브라우저는 홈 화면 설치가 막히고 로그인도 자주 풀려서, 가장 먼저 빼내는 게 목적. */
export default function InAppBrowserNotice() {
  const [dismissed, setDismissed] = useState(isInAppNoticeDismissed)
  const [copied, setCopied] = useState(false)

  // standalone(이미 설치 실행) 이거나 인앱이 아니거나, 사용자가 닫았으면 표시 안 함
  if (isStandalone() || !isInAppBrowser() || dismissed) return null

  const name = inAppBrowserName() ?? '앱 안 브라우저'
  const browser = isIos() ? 'Safari' : 'Chrome'

  async function onCopy() {
    setCopied(await copyLink())
  }
  function close() {
    dismissInAppNotice()
    setDismissed(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg px-6 pt-16 pb-8 text-center">
      <div className="flex flex-1 flex-col items-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-soft text-4xl">
          🧭
        </div>
        <h1 className="text-xl font-bold tracking-tight">{browser}로 열어주세요</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          지금 <b className="text-ink">{name}</b> 안에서 보고 있어요.
          <br />
          여기선 <b className="text-ink">홈 화면에 앱 추가</b>가 안 되고
          <br />
          로그인도 자꾸 풀릴 수 있어요.
        </p>
      </div>

      <div className="space-y-2.5">
        {canOpenExternal() ? (
          <Button onClick={openExternal}>{browser}로 열기</Button>
        ) : (
          <p className="rounded-2xl bg-surface px-4 py-3 text-xs leading-relaxed text-ink-soft">
            오른쪽 위 <b className="text-ink">···</b> 메뉴 →{' '}
            <b className="text-ink">{browser}로 열기</b>를 눌러주세요.
            <br />
            없으면 아래 <b className="text-ink">링크 복사</b> 후 {browser}에 붙여넣어요.
          </p>
        )}
        <Button variant="ghost" onClick={onCopy}>
          {copied ? '복사됐어요 ✓' : '링크 복사'}
        </Button>
        <button onClick={close} className="w-full pt-1 text-center text-xs text-ink-soft underline">
          그냥 여기서 볼게요
        </button>
      </div>
    </div>
  )
}
