import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDevLogin } from '../api/queries'
import {
  canTrySilentLogin,
  clearSilentLoginSkip,
  getPendingInviteCode,
  isLoggedIn,
  markSilentLoginAttempt,
  setHouseholdId,
} from '../lib/auth'
import { Button, ErrorText, LoadingScreen } from '../components/ui'
import { errorMessage } from '../api/client'
import type { LoginResponse } from '../api/types'

const KAKAO_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY

/** silent=true 면 prompt=none — 카카오 세션이 있으면 동의창 없이 즉시 code 발급, 없으면 error 로 복귀. */
function kakaoAuthorizeUrl(silent: boolean): string {
  const redirect = `${location.origin}/oauth/kakao/callback`
  return (
    `https://kauth.kakao.com/oauth/authorize?response_type=code` +
    `&client_id=${KAKAO_KEY}&redirect_uri=${encodeURIComponent(redirect)}` +
    (silent ? `&prompt=none&state=silent` : '')
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const devLogin = useDevLogin()
  const [nickname, setNickname] = useState('')
  const [err, setErr] = useState<string | null>(null)

  // 무클릭 자동 로그인: 토큰이 없어도(인앱 브라우저가 localStorage 를 날리는 경우 등)
  // 카카오 세션이 남아있으면 버튼 없이 바로 재로그인. 실패 시 callback 이 skip 플래그를 켜고 돌아온다.
  const [silentTrying] = useState(() => !!KAKAO_KEY && !isLoggedIn() && canTrySilentLogin())
  useEffect(() => {
    if (silentTrying) {
      markSilentLoginAttempt()
      location.replace(kakaoAuthorizeUrl(true))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function afterLogin(data: LoginResponse) {
    clearSilentLoginSkip() // 수동 로그인 성공 → 다음부터 자동 로그인 재개
    if (getPendingInviteCode()) {
      navigate('/onboarding/join', { replace: true }) // 초대 링크 경유 — 합류 화면으로 직행
    } else if (data.needsOnboarding || data.households.length === 0) {
      // needsOnboarding 과 households 비어있음은 같은 상태여야 하지만, 빈 배열이면 [0] 접근이 흰 화면을 부르므로 방어
      navigate('/onboarding', { replace: true })
    } else {
      setHouseholdId(data.households[0].householdId)
      navigate('/', { replace: true })
    }
  }

  function kakaoLogin() {
    if (!KAKAO_KEY) {
      setErr('카카오 키(VITE_KAKAO_REST_API_KEY)가 설정되지 않았습니다. 아래 개발용 로그인을 사용하세요.')
      return
    }
    location.href = kakaoAuthorizeUrl(false)
  }

  // 자동 시도 중엔 로그인 UI 깜빡임 없이 로딩만 (곧 카카오로 redirect 됨)
  if (silentTrying) return <LoadingScreen />

  function doDevLogin() {
    setErr(null)
    const name = nickname.trim() || '테스터'
    devLogin.mutate(
      { kakaoId: `dev_${name}`, nickname: name },
      { onSuccess: afterLogin, onError: (e) => setErr(errorMessage(e)) },
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex h-22 w-22 items-center justify-center rounded-3xl bg-brand text-5xl shadow-lg shadow-brand/30">
          🏠
        </div>
        <h1 className="text-2xl font-bold tracking-tight">곳간</h1>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
          집에 뭐가 있는지, 둘이 같이
          <br />
          한눈에 확인해요
        </p>
      </div>

      <div className="px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <Button variant="kakao" onClick={kakaoLogin}>
          💬 카카오로 시작하기
        </Button>

        {/* 개발용 로그인 — 로컬 dev 서버에서만 노출 (운영 빌드에선 코드째 제거됨).
            백엔드 /api/auth/dev-token 도 @Profile("!prod")라 운영에선 어차피 없음 */}
        {import.meta.env.DEV && (
          <div className="mt-6 rounded-2xl border border-line bg-surface/60 p-4">
            <p className="mb-2 text-xs font-semibold text-ink-soft">개발용 로그인 (로컬 전용)</p>
            <div className="flex gap-2">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임 (예: 현규)"
                className="flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand"
                onKeyDown={(e) => e.key === 'Enter' && doDevLogin()}
              />
              <button
                onClick={doDevLogin}
                disabled={devLogin.isPending}
                className="rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                입장
              </button>
            </div>
          </div>
        )}
        <ErrorText message={err} />
      </div>
    </div>
  )
}
