import { useNavigate, useParams } from 'react-router-dom'
import { useLocationStock, useLocations } from '../api/queries'
import { AppHeader, Fab, LoadingScreen } from '../components/ui'
import { StockRow } from '../components/StockRow'
import { PullToRefresh } from '../components/PullToRefresh'

export default function LocationDetailPage() {
  const { id } = useParams()
  const locationId = Number(id)
  const navigate = useNavigate()
  const { data: locations } = useLocations()
  const { data: stocks, isLoading, refetch } = useLocationStock(locationId)
  const loc = locations?.find((l) => l.id === locationId)

  if (isLoading || !stocks) return <LoadingScreen />

  return (
    <PullToRefresh onRefresh={refetch}>
      <div className="min-h-screen px-5 pb-24">
        <AppHeader title={`${loc?.emoji ?? '📦'} ${loc?.name ?? '위치'}`} back />
        <p className="mb-1 text-xs text-ink-soft">{stocks.length}개 · 유통기한 임박순</p>

        {stocks.length === 0 ? (
          <p className="mt-16 text-center text-sm text-ink-soft">아직 재고가 없어요. ＋로 추가하세요.</p>
        ) : (
          stocks.map((s) => <StockRow key={s.id} stock={s} />)
        )}

        <Fab onClick={() => navigate(`/stock/new?locationId=${locationId}`)} />
      </div>
    </PullToRefresh>
  )
}
