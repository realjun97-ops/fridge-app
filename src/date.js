// 날짜 계산 유틸 — 모든 비교는 '로컬 자정' 기준으로 합니다.
// (UTC 파싱으로 인한 하루 밀림, 시간대/DST 오차를 피하기 위함)

export const URGENT_DAYS = 3 // 며칠 이내를 '임박'으로 볼지

export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

// 'YYYY-MM-DD' 를 로컬 날짜로 파싱. 형식이 틀리거나 없는 날짜(2026-02-31 등)면 null
export function parseDateOnly(value) {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim())
  if (!m) return null
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3])
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

// 오늘(로컬 자정)과의 일수 차이. 오늘=0, 내일=1, 어제=-1
export function daysUntil(dateStr, now = new Date()) {
  const target = parseDateOnly(dateStr)
  if (!target) return null
  const diff = target.getTime() - startOfToday(now).getTime()
  return Math.round(diff / 86400000)
}

export function dLabel(d) {
  if (d === null || d === undefined) return ''
  if (d < 0) return `만료 D+${Math.abs(d)}`
  if (d === 0) return '오늘까지'
  return `D-${d}`
}

export function expiryColor(d) {
  if (d === null || d === undefined) return null
  if (d < 0) return '#dc2626'
  if (d <= URGENT_DAYS) return '#ef4444'
  if (d <= 7) return '#f59e0b'
  return '#22c55e'
}
