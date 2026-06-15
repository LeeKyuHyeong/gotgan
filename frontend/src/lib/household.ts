// 가구 진입(합류·컨텍스트 선택)의 결정 로직 — UI와 분리해 단위 테스트 가능하게 둔다.

/**
 * (D3) 현재 선택된 가구 id 를 내 소속 목록과 대조해 교정할 id 를 돌려준다.
 * - 유효하면(소속에 포함) null — 바꿀 필요 없음.
 * - null 이거나 더 이상 소속이 아닌 가구를 가리키면(킥/탈퇴/삭제) 첫 가구 id.
 * - 소속이 하나도 없으면 null(이 경우 호출부는 온보딩으로 보냄).
 *
 * 기존 RequireHousehold 는 hid 가 null 일 때만 첫 가구로 세팅해, 쫓겨난 가구 id 가
 * 그대로 남아 X-Household-Id 로 계속 전송돼 403 이 반복되던 문제를 막는다.
 */
export function reconcileHouseholdId(
  currentHid: number | null,
  householdIds: number[],
): number | null {
  if (householdIds.length === 0) return null
  if (currentHid != null && householdIds.includes(currentHid)) return null
  return householdIds[0]
}

export interface JoinPlan {
  /** 막아야 하면 사용자에게 보여줄 메시지 */
  error?: string
  /** 합류 전에 저장할 표시 이름(필요할 때만) */
  saveName?: string
  /** 정규화된 초대코드 */
  inviteCode?: string
}

/**
 * (B4) 합류 제출 계획. 초대 흐름은 온보딩의 표시이름 단계를 건너뛰므로,
 * 닉네임이 없으면 합류 전에 이름부터 받도록 강제한다(빈 이름으로 가구 합류 방지).
 */
export function planJoin(input: {
  needsName: boolean
  name: string
  code: string
}): JoinPlan {
  if (input.needsName && !input.name.trim()) {
    return { error: '표시 이름을 입력하세요.' }
  }
  if (!input.code.trim()) {
    return { error: '초대코드를 입력하세요.' }
  }
  return {
    saveName: input.needsName ? input.name.trim() : undefined,
    inviteCode: input.code.trim().toUpperCase(),
  }
}

/** 표시 이름이 비어있는지(미동의/미설정). */
export function needsDisplayName(nickname: string | null | undefined): boolean {
  return !nickname || !nickname.trim()
}
