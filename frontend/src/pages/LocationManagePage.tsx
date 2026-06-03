import { useNavigate } from 'react-router-dom'
import { useLocations } from '../api/queries'
import { AppHeader, LoadingScreen } from '../components/ui'

/** 위치 관리(구성원 누구나): 목록 + 추가/편집 진입. */
export default function LocationManagePage() {
  const navigate = useNavigate()
  const { data: locations, isLoading } = useLocations()

  if (isLoading || !locations) return <LoadingScreen />

  return (
    <div className="min-h-screen px-5 pb-8">
      <AppHeader
        title="위치 관리"
        back
        right={
          <button onClick={() => navigate('/locations/new')} className="text-[13px] font-semibold text-brand">
            ＋ 추가
          </button>
        }
      />
      <p className="mb-2 text-xs text-ink-soft">탭하면 편집할 수 있어요.</p>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {locations.map((l) => (
          <button
            key={l.id}
            onClick={() => navigate(`/locations/${l.id}/edit`)}
            className="flex w-full items-center gap-3 border-b border-line p-4 text-left last:border-none"
          >
            <span className="text-2xl">{l.emoji ?? '📦'}</span>
            <span className="flex-1 text-[15px] font-semibold">{l.name}</span>
            <span className="text-xs text-ink-soft">순서 {l.sortOrder}</span>
            <span className="text-lg text-ink-soft">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
