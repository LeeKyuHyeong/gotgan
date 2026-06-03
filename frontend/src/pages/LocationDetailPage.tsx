import { useNavigate, useParams } from 'react-router-dom'
import { useItems, useLocations } from '../api/queries'
import { AppHeader, Fab, LoadingScreen } from '../components/ui'
import { ItemRow } from '../components/ItemRow'
import { PullToRefresh } from '../components/PullToRefresh'

export default function LocationDetailPage() {
  const { id } = useParams()
  const locationId = Number(id)
  const navigate = useNavigate()
  const { data: locations } = useLocations()
  const { data: items, isLoading, refetch } = useItems({ locationId })
  const loc = locations?.find((l) => l.id === locationId)

  if (isLoading || !items) return <LoadingScreen />

  return (
    <PullToRefresh onRefresh={refetch}>
    <div className="min-h-screen px-5 pb-24">
      <AppHeader title={`${loc?.emoji ?? '📦'} ${loc?.name ?? '위치'}`} back />
      <p className="mb-1 text-xs text-ink-soft">{items.length}개 · 유통기한 임박순</p>

      {items.length === 0 ? (
        <p className="mt-16 text-center text-sm text-ink-soft">아직 아이템이 없어요. ＋로 추가하세요.</p>
      ) : (
        items.map((it) => <ItemRow key={it.id} item={it} />)
      )}

      <Fab onClick={() => navigate(`/items/new?locationId=${locationId}`)} />
    </div>
    </PullToRefresh>
  )
}
