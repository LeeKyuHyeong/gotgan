import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { isLoggedIn, setPendingInviteCode } from '../lib/auth'
import { LoadingScreen } from '../components/ui'

/** 카톡 공유 링크(/join?code=XXX) 진입점.
 *  코드를 보관해두고 로그인 여부에 따라 로그인 → 합류 화면으로 안내한다. */
export default function InviteLandingPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()

  useEffect(() => {
    const code = search.get('code')?.trim().toUpperCase()
    if (code) setPendingInviteCode(code)
    navigate(isLoggedIn() ? '/onboarding/join' : '/login', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <LoadingScreen />
}
