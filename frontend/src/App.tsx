import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { isLoggedIn, getHouseholdId, setHouseholdId } from './lib/auth'
import { useMe } from './api/queries'
import { LoadErrorScreen, LoadingScreen } from './components/ui'
import { BottomTabs } from './components/BottomTabs'
import LoginPage from './pages/LoginPage'
import KakaoCallbackPage from './pages/KakaoCallbackPage'
import OnboardingPage from './pages/OnboardingPage'
import CreateHouseholdPage from './pages/CreateHouseholdPage'
import JoinHouseholdPage from './pages/JoinHouseholdPage'
import InvitePage from './pages/InvitePage'
import HouseholdManagePage from './pages/HouseholdManagePage'
import HomePage from './pages/HomePage'
import AllItemsPage from './pages/AllItemsPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import LocationDetailPage from './pages/LocationDetailPage'
import LocationManagePage from './pages/LocationManagePage'
import LocationFormPage from './pages/LocationFormPage'
import ItemFormPage from './pages/ItemFormPage'
import AdminRequestsPage from './pages/AdminRequestsPage'
import AdminCategoriesPage from './pages/AdminCategoriesPage'

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

  // 현재 가구가 안 잡혀있으면 첫 가구로 설정
  if (getHouseholdId() == null && me.households.length > 0) {
    setHouseholdId(me.households[0].householdId)
  }
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
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/oauth/kakao/callback" element={<KakaoCallbackPage />} />

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
          <Route path="/items/new" element={<ItemFormPage />} />
          <Route path="/items/:id/edit" element={<ItemFormPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
