// src/data.js 검증용
import { migrateSections, normalizeItem, collectEntries, filterEntries, collectUrgent, buildLocalRecipes, buildInitialSections } from '../src/data.js'

let pass = 0
let fail = 0
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.error(`FAIL ${label}`) } }
const eq = (label, a, b) => { if (Object.is(a, b)) pass++; else { fail++; console.error(`FAIL ${label}: actual=${JSON.stringify(a)} expected=${JSON.stringify(b)}`) } }

// --- migrateSections
const empty = migrateSections(null)
eq('기본 4구역', Object.keys(empty).length, 4)
eq('냉장 좌 4칸', empty.fridge_left.slots.length, 4)
eq('냉동 우 3칸', empty.freeze_right.slots.length, 3)
eq('라벨 유지', empty.fridge_left.label, '냉장 좌')

const broken = migrateSections({
  fridge_left: { slots: [null, { items: 'not-array' }, { items: [{ name: '사과', category: 'fruit' }, { name: '   ' }, null] }] },
  weird: 'not-a-section',
})
eq('깨진 칸은 빈 칸', broken.fridge_left.slots[0].items.length, 0)
eq('items 문자열은 무시', broken.fridge_left.slots[1].items.length, 0)
eq('유효 항목만 유지', broken.fridge_left.slots[2].items.length, 1)
eq('알 수 없는 카테고리 → other', broken.fridge_left.slots[2].items[0].category, 'other')
eq('이름 공백 제거', broken.fridge_left.slots[2].items[0].name, '사과')
eq('깨진 구역 무시', broken.weird, undefined)
eq('나머지 구역 기본값', broken.freeze_left.slots.length, 3)

eq('normalizeItem null', normalizeItem(null), null)
eq('normalizeItem 이름 없음', normalizeItem({ quantity: 2 }), null)
eq('normalizeItem 숫자 이름', normalizeItem({ name: 2024 }).name, '2024')

// --- 테스트용 데이터
const now = new Date(2026, 10, 15, 12, 0, 0) // 2026-11-15 정오
const sections = {
  fridge_left: { label: '냉장 좌', type: 'fridge', slots: [
    { items: [{ id: 'a', name: '삼겹살', category: 'meat', quantity: '300', unit: 'g', expiry: '2026-11-17' }] },
    { items: [] },
    { items: [{ name: '사과', category: 'other', expiry: '2026-11-10' }, { name: '우유', category: 'dairy', expiry: '2026-11-16' }] },
    { items: [] },
  ] },
  fridge_right: { label: '냉장 우', type: 'fridge', slots: [
    { items: [{ name: '대파', category: 'veggie', expiry: '' }] },
    { items: [] }, { items: [] }, { items: [] },
  ] },
  freeze_left: { label: '냉동 좌', type: 'freeze', slots: [{ items: [] }, { items: [] }, { items: [] }] },
  freeze_right: { label: '냉동 우', type: 'freeze', slots: [{ items: [] }, { items: [] }, { items: [] }] },
}

const entries = collectEntries(sections, now)
eq('전체 항목 수', entries.length, 4)

const apple = entries.find(e => e.item.name === '사과')
eq('사과 위치 구역', apple.sectionLabel, '냉장 좌')
eq('사과 위치 칸(1-based 표시는 +1)', apple.slotIdx, 2)
eq('사과 칸 내 순번', apple.itemIndex, 0)
eq('사과 만료 -5일', apple.days, -5)
eq('우유 D-1', entries.find(e => e.item.name === '우유').days, 1)
eq('삼겹살 D-2', entries.find(e => e.item.name === '삼겹살').days, 2)
eq('대파 날짜 없음', entries.find(e => e.item.name === '대파').days, null)
eq('key 는 id 우선', entries.find(e => e.item.name === '삼겹살').key, 'a')
eq('key 없으면 위치 기반', entries.find(e => e.item.name === '우유').key, 'fridge_left-2-1')

// --- 검색
eq('이름 검색', filterEntries(entries, '사과').length, 1)
eq('부분 이름', filterEntries(entries, '겹').length, 1)
eq('카테고리 한글', filterEntries(entries, '유제품').map(e => e.item.name).join(','), '우유')
eq('카테고리 영문 id', filterEntries(entries, 'meat').map(e => e.item.name).join(','), '삼겹살')
eq('구역 검색', filterEntries(entries, '냉장 좌').length, 3)
eq('구역+이름 AND', filterEntries(entries, '냉장 좌 사과').length, 1)
eq('공백 무시', filterEntries(entries, '  사과  ').length, 1)
eq('대소문자 무시', filterEntries(entries, 'MEAT').length, 1)
eq('없는 검색어', filterEntries(entries, '두부').length, 0)
eq('빈 검색어', filterEntries(entries, '').length, 0)
eq('공백만', filterEntries(entries, '   ').length, 0)
eq('null 검색어', filterEntries(entries, null).length, 0)

// --- 임박/만료
const urgent = collectUrgent(entries)
eq('임박·만료 개수', urgent.length, 3)
eq('급한 순 정렬', urgent.map(e => e.item.name).join(','), '사과,우유,삼겹살')
eq('만료 개수', urgent.filter(e => e.days < 0).length, 1)
eq('임박 개수', urgent.filter(e => e.days >= 0).length, 2)
eq('D-4 는 제외', collectUrgent([{ days: 4 }]).length, 0)
eq('날짜 없음 제외', collectUrgent([{ days: null }]).length, 0)
eq('빈 목록', collectUrgent([]).length, 0)

// --- 기본 레시피 폴백
const items = [
  { name: '삼겹살', category: 'meat' },
  { name: '대파', category: 'veggie' },
  { name: '우유', category: 'dairy' },
  { name: '스파게티면', category: 'processed' },
]
const recipes = buildLocalRecipes(items)
ok('레시피 1개 이상', recipes.length >= 1)
ok('고기+채소 조합 포함', recipes.some(r => r.title.includes('단백질')))
ok('채소 조합 포함', recipes.some(r => r.title.includes('채소')))
ok('유제품 조합 포함', recipes.some(r => r.title.includes('유제품')))
ok('모든 레시피에 재료/단계', recipes.every(r => r.uses.length > 0 && r.steps.length > 0))
eq('빈 냉장고도 결과 1개', buildLocalRecipes([]).length, 1)
eq('재료 없으면 기본 문구', buildLocalRecipes([])[0].uses.length, 0)
ok('냉동만 있어도 결과', buildLocalRecipes([{ name: '만두', category: 'processed' }]).length >= 1)

// --- 초기 구조는 호출마다 새 객체 (초기화 후 데이터가 섞이지 않도록)
const s1 = buildInitialSections()
const s2 = buildInitialSections()
eq('초기 구조 독립', s1.fridge_left === s2.fridge_left, false)

console.log(`data.js: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
