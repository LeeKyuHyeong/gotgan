import { describe, expect, it } from 'vitest'
import { needsDisplayName, planJoin, reconcileHouseholdId } from './household'

describe('reconcileHouseholdId (D3: stale householdId 교정)', () => {
  it('소속이 없으면 null (온보딩 대상)', () => {
    expect(reconcileHouseholdId(null, [])).toBeNull()
    expect(reconcileHouseholdId(7, [])).toBeNull()
  })

  it('현재 가구가 소속에 있으면 그대로 둔다 (null = 변경 없음)', () => {
    expect(reconcileHouseholdId(7, [7])).toBeNull()
    expect(reconcileHouseholdId(7, [3, 7, 9])).toBeNull()
  })

  it('현재 가구가 없으면(null) 첫 가구로', () => {
    expect(reconcileHouseholdId(null, [3, 9])).toBe(3)
  })

  it('쫓겨난/탈퇴한 가구를 가리키면 첫 소속 가구로 교정', () => {
    // 7번에서 킥당했고 남은 소속은 3,9 → 7은 더 이상 유효하지 않음
    expect(reconcileHouseholdId(7, [3, 9])).toBe(3)
  })
})

describe('planJoin (B4: 표시이름 없이 합류 방지)', () => {
  it('이름이 필요한데 비어있으면 막는다', () => {
    expect(planJoin({ needsName: true, name: '  ', code: 'K7M3PQ' })).toEqual({
      error: '표시 이름을 입력하세요.',
    })
  })

  it('초대코드가 비어있으면 막는다', () => {
    expect(planJoin({ needsName: false, name: '', code: '   ' })).toEqual({
      error: '초대코드를 입력하세요.',
    })
  })

  it('이름이 필요하면 정리한 이름 + 정규화 코드를 함께 계획', () => {
    expect(planJoin({ needsName: true, name: ' 현규 ', code: ' k7m3pq ' })).toEqual({
      saveName: '현규',
      inviteCode: 'K7M3PQ',
    })
  })

  it('이름이 이미 있으면 saveName 없이 코드만 정규화', () => {
    expect(planJoin({ needsName: false, name: '', code: 'k7m3pq' })).toEqual({
      saveName: undefined,
      inviteCode: 'K7M3PQ',
    })
  })

  it('이름 검증이 코드 검증보다 먼저', () => {
    expect(planJoin({ needsName: true, name: '', code: '' }).error).toBe('표시 이름을 입력하세요.')
  })
})

describe('needsDisplayName', () => {
  it('null/빈문자/공백은 이름 필요', () => {
    expect(needsDisplayName(null)).toBe(true)
    expect(needsDisplayName(undefined)).toBe(true)
    expect(needsDisplayName('')).toBe(true)
    expect(needsDisplayName('   ')).toBe(true)
  })
  it('실제 이름이 있으면 불필요', () => {
    expect(needsDisplayName('현규')).toBe(false)
  })
})
