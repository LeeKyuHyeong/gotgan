import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useKakaoLogin } from '../api/queries'
import { getPendingInviteCode, setHouseholdId } from '../lib/auth'
import { errorMessage } from '../api/client'
import { Button } from '../components/ui'

// 모듈 레벨 가드: StrictMode 이중 실행/리마운트에도 같은 code 는 1회만 교환.
let exchangedCode: string | null = null

/** 카카오가 redirect_uri 로 돌려보낸 ?code= 를 받아 백엔드와 교환 → JWT 저장. */
export default function KakaoCallbackPage() {
  const [search] = useSearchParams()
  const kakaoLogin = useKakaoLogin()
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const code = search.get('code')
    const kakaoError = search.get('error')
    if (kakaoError) {
      setErr('카카오 로그인이 취소되었습니다.')
      return
    }
    if (!code) {
      setErr('인가 코드가 없습니다.')
      return
    }
    if (exchangedCode === code) return // 같은 코드 재교환 방지(단일 사용)
    exchangedCode = code

    // mutateAsync 의 Promise 는 컴포넌트 언마운트와 무관하게 resolve →
    // StrictMode 로 인스턴스가 폐기돼도 .then 이 실행되고, window.location 은 전역이라 확실히 이동.
    kakaoLogin
      .mutateAsync({ code })
      .then((data) => {
        if (getPendingInviteCode()) {
          // 초대 링크로 들어온 경우: 온보딩/홈 대신 합류 화면으로 직행(코드 자동 입력)
          window.location.replace('/onboarding/join')
        } else if (data.needsOnboarding) {
          window.location.replace('/onboarding')
        } else {
          setHouseholdId(data.households[0].householdId)
          window.location.replace('/')
        }
      })
      .catch((e) => {
        exchangedCode = null // 실패 시 재시도 가능하도록 해제
        setErr(errorMessage(e, '카카오 로그인에 실패했습니다.'))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {err ? (
        <>
          <div className="mb-3 text-3xl">😢</div>
          <p className="text-sm text-ink-soft">{err}</p>
          <div className="mt-6 w-full max-w-xs">
            <Button variant="ghost" onClick={() => window.location.replace('/login')}>
              로그인으로 돌아가기
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-soft">카카오 로그인 처리 중…</p>
      )}
    </div>
  )
}
