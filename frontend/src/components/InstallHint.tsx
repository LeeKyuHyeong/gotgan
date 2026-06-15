import { useEffect, useState } from 'react'
import {
  dismissInstallHint,
  hasInstallPrompt,
  isInAppBrowser,
  isInstallHintDismissed,
  isIos,
  isStandalone,
  onInstallPromptChange,
  promptInstall,
} from '../lib/install'

/** 일반 브라우저에서 "앱처럼 설치" 권유하는 하단 배너.
 *  - 안드로이드 Chrome: 네이티브 설치 프롬프트 버튼
 *  - iOS Safari: 공유 → 홈 화면에 추가 안내
 *  인앱 브라우저/이미 설치(standalone)/사용자가 닫음 → 표시 안 함. */
export default function InstallHint() {
  const [promptReady, setPromptReady] = useState(hasInstallPrompt)
  const [dismissed, setDismissed] = useState(isInstallHintDismissed)
  const [showIosGuide, setShowIosGuide] = useState(false)

  // beforeinstallprompt 는 늦게 발화할 수 있어 구독해서 동기화
  useEffect(() => onInstallPromptChange(() => setPromptReady(hasInstallPrompt())), [])

  if (isStandalone() || isInAppBrowser() || dismissed) return null

  const ios = isIos()
  // 안드로이드는 네이티브 프롬프트가 준비됐을 때만, iOS 는 Safari 안내로 항상 노출
  if (!ios && !promptReady) return null

  function close() {
    dismissInstallHint()
    setDismissed(true)
  }

  async function onInstall() {
    const accepted = await promptInstall()
    if (accepted) close()
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3">
      <div className="mx-auto max-w-[480px] rounded-2xl border border-line bg-surface p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-xl">
            🏠
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-bold">곳간을 앱으로 설치하기</p>
            <p className="mt-0.5 text-xs leading-snug text-ink-soft">
              홈 화면에 추가하면 알림도 받고 한 번에 열려요.
            </p>
          </div>
          <button onClick={close} aria-label="닫기" className="-mt-1 text-xl leading-none text-ink-soft">
            ×
          </button>
        </div>

        {ios ? (
          <>
            <button
              onClick={() => setShowIosGuide((v) => !v)}
              className="mt-3 w-full rounded-xl bg-brand py-2.5 text-[14px] font-bold text-white"
            >
              홈 화면에 추가하는 법
            </button>
            {showIosGuide && (
              <ol className="mt-3 space-y-1.5 rounded-xl bg-bg px-4 py-3 text-xs leading-relaxed text-ink-soft">
                <li>
                  1. 하단(또는 상단)의 <b className="text-ink">공유 버튼 ⬆️</b>을 누르세요.
                </li>
                <li>
                  2. 메뉴에서 <b className="text-ink">‘홈 화면에 추가’</b>를 선택해요.
                </li>
                <li>
                  3. 오른쪽 위 <b className="text-ink">‘추가’</b>를 누르면 끝!
                </li>
                <li className="pt-1 text-[11px]">※ Safari에서만 가능해요.</li>
              </ol>
            )}
          </>
        ) : (
          <button
            onClick={onInstall}
            className="mt-3 w-full rounded-xl bg-brand py-2.5 text-[14px] font-bold text-white"
          >
            앱 설치
          </button>
        )}
      </div>
    </div>
  )
}
