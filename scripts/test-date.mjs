// src/date.js 검증용 (node --test 없이 간단 실행)
import { daysUntil, parseDateOnly, dLabel, expiryColor } from '../src/date.js'

let pass = 0
let fail = 0
const eq = (label, actual, expected) => {
  const ok = Object.is(actual, expected)
  if (ok) pass++
  else { fail++; console.error(`FAIL ${label}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`) }
}

const at = (y, m, d, hh = 12, mm = 0) => new Date(y, m - 1, d, hh, mm)
const now = at(2026, 11, 15, 12) // 2026-11-15 정오 (로컬)

// 기본 D-day
eq('오늘', daysUntil('2026-11-15', now), 0)
eq('내일', daysUntil('2026-11-16', now), 1)
eq('3일 뒤', daysUntil('2026-11-18', now), 3)
eq('어제', daysUntil('2026-11-14', now), -1)
eq('일주일 전', daysUntil('2026-11-08', now), -7)
eq('공백 제거', daysUntil('  2026-11-20  ', now), 5)

// 자정 직후/직전에도 하루가 밀리지 않아야 함 (기존 UTC 파싱 버그 회귀 테스트)
eq('자정 직후 오늘', daysUntil('2026-11-15', at(2026, 11, 15, 0, 5)), 0)
eq('자정 직전 오늘', daysUntil('2026-11-15', at(2026, 11, 15, 23, 55)), 0)
eq('자정 직후 내일', daysUntil('2026-11-16', at(2026, 11, 15, 0, 5)), 1)
eq('자정 직전 내일', daysUntil('2026-11-16', at(2026, 11, 15, 23, 55)), 1)
eq('자정 직후 어제', daysUntil('2026-11-14', at(2026, 11, 15, 0, 5)), -1)

// 잘못된 입력은 null (예외 없이)
eq('빈 값', daysUntil('', now), null)
eq('null', daysUntil(null, now), null)
eq('undefined', daysUntil(undefined, now), null)
eq('엉터리', daysUntil('abc', now), null)
eq('없는 날짜', daysUntil('2026-02-31', now), null)
eq('13월', daysUntil('2026-13-01', now), null)
eq('시각 포함', daysUntil('2026-11-16T00:00:00', now), null)
eq('parseDateOnly 유효', parseDateOnly('2026-02-28') instanceof Date, true)
eq('parseDateOnly 윤년', parseDateOnly('2028-02-29') instanceof Date, true)
eq('parseDateOnly 윤년 아님', parseDateOnly('2027-02-29'), null)

// 날짜 이동이 있는 시간대(DST)에서도 일수 계산이 정확해야 함
// America/Los_Angeles: 2026-03-08 (봄, 하루 23시간), 2026-11-01 (가을, 하루 25시간)
eq('DST 봄 이후 2일', daysUntil('2026-03-09', at(2026, 3, 7, 12)), 2)
eq('DST 가을 이후 2일', daysUntil('2026-11-02', at(2026, 10, 31, 12)), 2)
eq('DST 가을 이전 -2일', daysUntil('2026-10-30', at(2026, 11, 1, 12)), -2)

// 표시/색상
eq('라벨 만료', dLabel(-2), '만료 D+2')
eq('라벨 오늘', dLabel(0), '오늘까지')
eq('라벨 D-3', dLabel(3), 'D-3')
eq('색 만료', expiryColor(-1), '#dc2626')
eq('색 임박', expiryColor(3), '#ef4444')
eq('색 7일', expiryColor(7), '#f59e0b')
eq('색 여유', expiryColor(30), '#22c55e')
eq('색 없음', expiryColor(null), null)

console.log(`date.js: ${pass} passed, ${fail} failed (TZ=${process.env.TZ || 'system'})`)
process.exit(fail ? 1 : 0)
