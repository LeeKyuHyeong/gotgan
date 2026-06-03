import type { ItemAction } from '../api/types'

/** 변동 이력 액션 한글 라벨. 전체 이력 탭·아이템별 이력 공용. */
export const ACTION_LABEL: Record<ItemAction, string> = {
  CREATE: '추가',
  INCREASE: '증가',
  DECREASE: '감소',
  UPDATE: '수정',
  DELETE: '삭제',
}

/** 'yyyy-MM-ddTHH:mm:ss' → 'MM/dd HH:mm' */
export function fmtDateTime(iso: string) {
  return `${iso.slice(5, 10).replace('-', '/')} ${iso.slice(11, 16)}`
}
