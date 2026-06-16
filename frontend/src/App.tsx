import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { isLoggedIn, getHouseholdId, setHouseholdId } from './lib/auth'
import { reconcileHouseholdId } from './lib/household'
import { useMe } from './api/queries'
import { LoadErrorScreen, LoadingScreen } from './components/ui'
import { BottomTabs } from './components/BottomTabs'
import InAppBrowserNotice from './components/InAppBrowserNotice'
import InstallHint from './components/InstallHint'
// 첫 화면(로그인/콜백)만 즉시 로드. 나머지는 lazy 로 분할 — 로그인 시 admin·재고추가(프리셋 198개)까지 안 받게.
import LoginPage from './pages/LoginPage'
import KakaoCallbackPage from './pages/KakaoCallbackPage'
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const InviteLandingPage = lazy(() => import('./pages/InviteLandingPage'))
const CreateHouseholdPage = lazy(() => import('./pages/CreateHouseholdPage'))
const JoinHouseholdPage = lazy(() => import('./pages/JoinHouseholdPage'))
const InvitePage = lazy(() => import('./pages/InvitePage'))
const HouseholdManagePage = lazy(() => import('./pages/HouseholdManagePage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const AllItemsPage = lazy(() => import('./pages/AllItemsPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const LocationDetailPage = lazy(() => import('./pages/LocationDetailPage'))
const LocationManagePage = lazy(() => import('./pages/LocationManagePage'))
const LocationFormPage = lazy(() => import('./pages/LocationFormPage'))
const StockAddPage = lazy(() => import('./pages/StockAddPage'))
const StockEditPage = lazy(() => import('./pages/StockEditPage'))
const AdminRequestsPage = lazy(() => import('./pages/AdminRequestsPage'))
const AdminCategoriesPage = lazy(() => import('./pages/AdminCategoriesPage'))

function RequireAuth() {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return <Outlet />
}

/** 플랫폼 운영자(SYSTEM_ADMIN) 전용. 가구 컨텍스트 불필요. */
function RequireAdmin() {
  const { data: me, isLoading, isError } = useMe()
  if (isLoading) return <LoadingScreen />
  if (isError || !me || me.user.role !== 'SYSTEM_ADMIN') return <Navigate to="/" replace />
  return <Outlet />
}

/** 로그인됐지만 가구 컨텍스트가 필요한 화면용. 온보딩 안 됐으면 온보딩으로. */
function RequireHousehold() {
  const { data: me, isLoading, isError, refetch } = useMe()
  if (isLoading) return <LoadingScreen />
  if (isError || !me) return <LoadErrorScreen onRetry={() => refetch()} />
  if (me.needsOnboarding) return <Navigate to="/onboarding" replace />

  // 현재 가구가 비었거나 더 이상 소속이 아니면(킥/탈퇴/삭제) 첫 가구로 교정
  const next = reconcileHouseholdId(
    getHouseholdId(),
    me.households.map((h) => h.householdId),
  )
  if (next != null) setHouseholdId(next)
  return <MainLayout />
}

function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 pb-2">
        <Outlet />
      </main>
      <BottomTabs />
    </div>
  )
}

export default function App() {
  return (
    <>
      {/* 인앱 브라우저 탈출 안내 + 설치 권유 — 라우트와 무관하게 전역 노출 */}
      <InAppBrowserNotice />
      <InstallHint />
      <Suspense fallback={<LoadingScreen />}>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/oauth/kakao/callback" element={<KakaoCallbackPage />} />
      {/* 초대 공유 링크 진입점 — 비로그인도 접근 가능해야 해서 RequireAuth 밖 */}
      <Route path="/join" element={<InviteLandingPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/onboarding/create" element={<CreateHouseholdPage />} />
        <Route path="/onboarding/join" element={<JoinHouseholdPage />} />
        <Route path="/households/:id/invite" element={<InvitePage />} />
        <Route path="/households/:id/manage" element={<HouseholdManagePage />} />

        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminRequestsPage />} />
          <Route path="/admin/categories" element={<AdminCategoriesPage />} />
        </Route>

        <Route element={<RequireHousehold />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/all" element={<AllItemsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/me" element={<SettingsPage />} />
          <Route path="/locations" element={<LocationManagePage />} />
          <Route path="/locations/new" element={<LocationFormPage />} />
          <Route path="/locations/:id/edit" element={<LocationFormPage />} />
          <Route path="/locations/:id" element={<LocationDetailPage />} />
          <Route path="/stock/new" element={<StockAddPage />} />
          <Route path="/stock/:id/edit" element={<StockEditPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  )
}
