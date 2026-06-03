// 분류 색상 팔레트(#rrggbb). 어드민 분류 추가/수정·승인에서 공용. 빈값(미지정)이면 기본 톤.
export const CATEGORY_COLORS = [
  '#6aa8e0', '#5bb381', '#6fbf5b', '#e0584f', '#c95c6e',
  '#5bbfd4', '#e08a3f', '#c79a5b', '#b0823f', '#8f86d8',
  '#4fb6c0', '#d65d8f', '#d255a0', '#a98c4a', '#e0b341',
  '#7a9e3f', '#5a7fd0', '#cf6b4a', '#9b59b6', '#8a8a8a',
] as const

/** 분류 색 위에 올릴 옅은 배경(틴트). 색이 없으면 기본 라인 톤. */
export function tintBg(color?: string | null): string {
  return color ? `${color}22` : 'rgb(232 227 216 / 0.5)' // #color + 13% alpha / line/50
}
