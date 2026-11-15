// 앱의 데이터 모델 · 순수 로직 (UI와 분리해 테스트 가능하게 유지)
import { URGENT_DAYS, daysUntil } from './date.js'

export const CATEGORIES = [
  { id: 'meat',      emoji: '🥩', label: '육류',   color: '#ef4444' },
  { id: 'seafood',   emoji: '🐟', label: '해산물', color: '#3b82f6' },
  { id: 'veggie',    emoji: '🥦', label: '채소',   color: '#22c55e' },
  { id: 'dairy',     emoji: '🥛', label: '유제품', color: '#f59e0b' },
  { id: 'banchan',   emoji: '🍽️', label: '반찬',   color: '#ec4899' },
  { id: 'soup',      emoji: '🍜', label: '국',     color: '#f97316' },
  { id: 'jjigae',    emoji: '🫕', label: '찌개',   color: '#dc2626' },
  { id: 'drink',     emoji: '🧃', label: '음료',   color: '#10b981' },
  { id: 'alcohol',   emoji: '🍺', label: '주류',   color: '#d97706' },
  { id: 'processed', emoji: '🍱', label: '가공',   color: '#8b5cf6' },
  { id: 'other',     emoji: '📦', label: '기타',   color: '#6b7280' },
]

export const SLOT_LABELS = { fridge_left: '냉장 좌', fridge_right: '냉장 우', freeze_left: '냉동 좌', freeze_right: '냉동 우' }

export const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1]

export const makeSlot = () => ({ items: [] })

export const buildInitialSections = () => ({
  fridge_left:  { label: '냉장 좌', type: 'fridge', slots: [makeSlot(), makeSlot(), makeSlot(), makeSlot()] },
  fridge_right: { label: '냉장 우', type: 'fridge', slots: [makeSlot(), makeSlot(), makeSlot(), makeSlot()] },
  freeze_left:  { label: '냉동 좌', type: 'freeze', slots: [makeSlot(), makeSlot(), makeSlot()] },
  freeze_right: { label: '냉동 우', type: 'freeze', slots: [makeSlot(), makeSlot(), makeSlot()] },
})

/* ---------- 저장 데이터 정규화 ---------- */
export function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const name = typeof raw.name === 'string' ? raw.name : String(raw.name ?? '')
  if (!name.trim()) return null
  return {
    ...raw,
    name: name.trim(),
    category: getCat(raw.category).id,
    quantity: raw.quantity ?? '',
    unit: typeof raw.unit === 'string' && raw.unit ? raw.unit : '개',
    expiry: typeof raw.expiry === 'string' ? raw.expiry : '',
  }
}

// 서버에서 받은 sections 를 항상 안전한 4구역 형태로 맞춥니다.
export function migrateSections(raw) {
  const base = buildInitialSections()
  if (!raw || typeof raw !== 'object') return base
  const out = { ...base }
  for (const [key, sec] of Object.entries(raw)) {
    if (!sec || typeof sec !== 'object') continue
    const slots = Array.isArray(sec.slots) ? sec.slots : []
    out[key] = {
      label: typeof sec.label === 'string' && sec.label ? sec.label : (SLOT_LABELS[key] || key),
      type: sec.type === 'freeze' ? 'freeze' : 'fridge',
      slots: slots.map(s => {
        const items = Array.isArray(s?.items) ? s.items : []
        return { items: items.map(normalizeItem).filter(Boolean) }
      }),
    }
  }
  return out
}

export const newItemId = () =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `it_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

/* ---------- 검색 / 임박 목록 ---------- */
// 모든 식재료를 구역·칸 위치와 D-day 를 붙여 펼칩니다.
export function collectEntries(sections, now = new Date()) {
  const list = []
  for (const [sectionId, sec] of Object.entries(sections || {})) {
    const slots = Array.isArray(sec?.slots) ? sec.slots : []
    slots.forEach((slot, slotIdx) => {
      (slot?.items || []).forEach((item, itemIndex) => {
        list.push({
          key: item.id || `${sectionId}-${slotIdx}-${itemIndex}`,
          sectionId,
          sectionLabel: SLOT_LABELS[sectionId] || sec?.label || sectionId,
          slotIdx,
          itemIndex,
          item,
          days: daysUntil(item.expiry, now),
        })
      })
    })
  }
  return list
}

// 이름 · 카테고리(한글/영문 id) · 위치로 AND 검색
export function filterEntries(entries, query) {
  const trimmed = String(query ?? '').trim()
  if (!trimmed) return []
  const terms = trimmed.toLowerCase().split(/\s+/).filter(Boolean)
  return (entries || []).filter(e => {
    const cat = getCat(e.item.category)
    const hay = [e.item.name, cat.label, cat.id, e.sectionLabel, e.item.quantity, e.item.unit]
      .join(' ').toLowerCase()
    return terms.every(t => hay.includes(t))
  })
}

// 만료·임박(D-day <= URGENT_DAYS) 항목을 급한 순서로
export function collectUrgent(entries, urgentDays = URGENT_DAYS) {
  return (entries || [])
    .filter(e => e.days !== null && e.days <= urgentDays)
    .sort((a, b) => a.days - b.days)
}

/* ---------- 서버 없이 동작하는 기본 레시피 조합 ---------- */
export function buildLocalRecipes(items) {
  const withCat = (...cats) => items.filter(i => cats.includes(getCat(i.category).id))
  const names = (arr, n = 3) => Array.from(new Set(arr.map(i => i.name).filter(Boolean))).slice(0, n)
  const protein = withCat('meat', 'seafood')
  const veg = withCat('veggie')
  const side = withCat('banchan', 'soup', 'jjigae')
  const dairy = withCat('dairy')
  const grain = withCat('processed', 'other')

  const out = []
  if (protein.length && (veg.length || side.length)) {
    const p = names(protein); const v = names([...veg, ...side])
    out.push({
      title: '단백질 + 채소 든든 한 끼',
      uses: [...p, ...v],
      steps: [`${p.join(' · ')}은(는) 한입 크기로 손질해 밑간합니다.`, `${v.join(' · ')}을(를) 팬에 볶아 숨을 죽입니다.`, '재료를 한데 볶거나 물을 자작하게 부어 끓여 마무리합니다.'],
    })
  }
  if (veg.length) {
    const v = names(veg)
    out.push({
      title: '냉장고 채소 빠른 볶음',
      uses: v,
      steps: ['채소를 먹기 좋은 크기로 썹니다.', '기름 두른 팬에 단단한 채소부터 넣고 센 불에 볶습니다.', '소금·간장·참기름으로 간해 접시에 담습니다.'],
    })
  }
  if (dairy.length && grain.length) {
    const d = names(dairy); const g = names(grain)
    out.push({
      title: '유제품 활용 크림·치즈 한 접시',
      uses: [...d, ...g],
      steps: ['면이나 가공 재료를 삶거나 데웁니다.', '약한 불 팬에 유제품을 풀어 소스를 만듭니다.', '재료를 넣고 섞어 후추로 마무리합니다.'],
    })
  }
  if (side.length) {
    const s = names(side)
    out.push({
      title: '반찬·국 데워서 한 상',
      uses: s,
      steps: ['냄비나 전자레인지로 충분히 데웁니다.', '밥에 곁들여 한 끼로 차립니다.', '남은 반찬은 밀폐해 냉장 보관합니다.'],
    })
  }
  if (protein.length && !veg.length) {
    const p = names(protein)
    out.push({
      title: '간단 구이 · 팬프라이',
      uses: p,
      steps: ['재료의 물기를 닦고 소금·후추로 밑간합니다.', '달군 팬에 겉면을 노릇하게 굽습니다.', '속까지 익었는지 확인해 마무리합니다.'],
    })
  }
  if (!out.length) {
    const any = names(items, 4)
    out.push({
      title: '있는 재료 그대로 가볍게',
      uses: any,
      steps: ['재료를 씻어 먹기 좋게 준비합니다.', '간장·식초·참기름으로 간단한 소스를 만들어 곁들입니다.'],
    })
  }
  return out
}
