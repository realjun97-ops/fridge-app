import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase.js'
import { URGENT_DAYS, parseDateOnly, daysUntil, dLabel, expiryColor } from './date.js'
import {
  CATEGORIES, SLOT_LABELS, getCat, buildInitialSections, migrateSections, newItemId,
  collectEntries, filterEntries, collectUrgent, buildLocalRecipes,
} from './data.js'

const FRIDGE_ID = 'my-fridge'
const INITIAL_SECTIONS = buildInitialSections()

const inp = {
  width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid #d1d5db',
  background: '#fff', color: '#1f2937', fontSize: 13, outline: 'none', boxSizing: 'border-box',
}
const btn = {
  padding: '9px 16px', borderRadius: 9, border: '1px solid #d1d5db',
  background: '#f9fafb', color: '#374151', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.15s',
}
const iconBtn = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, padding: '3px 5px', borderRadius: 6 }
const cardStyle = {
  width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14,
  boxShadow: '0 6px 18px rgba(15,23,42,0.06)', overflow: 'hidden',
}

/* ---------- 칸(슬롯) 패널 ---------- */
function SlotPanel({ slot, sectionId, slotIdx, isFreezer, onOpenSlot, highlighted }) {
  const items = slot.items || []
  const hasItems = items.length > 0
  const urgentCount = items.filter(i => { const d = daysUntil(i.expiry); return d !== null && d <= URGENT_DAYS }).length
  const borderColor = highlighted
    ? '#3b82f6'
    : hasItems ? (isFreezer ? '#93c5fd' : '#d4a96a') : (isFreezer ? '#bfdbfe' : '#e5c99a')
  const open = () => onOpenSlot({ sectionId, slotIdx, itemCount: items.length })
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${SLOT_LABELS[sectionId] || sectionId} ${slotIdx + 1}번 칸, 식재료 ${items.length}개`}
      onClick={open}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
      style={{
        flex: 1, borderRadius: 8, position: 'relative', overflow: 'hidden',
        border: `${highlighted ? 2.5 : 1.5}px ${hasItems ? 'solid' : 'dashed'} ${borderColor}`,
        boxShadow: highlighted ? '0 0 0 3px rgba(59,130,246,0.18)' : 'none',
        background: isFreezer
          ? hasItems ? 'rgba(219,234,254,0.5)' : 'rgba(239,246,255,0.4)'
          : hasItems ? 'rgba(254,243,219,0.6)' : 'rgba(255,249,235,0.4)',
        cursor: 'pointer', padding: 5, transition: 'background 0.18s',
        minHeight: isFreezer ? 80 : 72,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = isFreezer ? 'rgba(219,234,254,0.8)' : 'rgba(254,243,219,0.9)' }}
      onMouseLeave={e => { e.currentTarget.style.background = isFreezer ? (hasItems ? 'rgba(219,234,254,0.5)' : 'rgba(239,246,255,0.4)') : (hasItems ? 'rgba(254,243,219,0.6)' : 'rgba(255,249,235,0.4)') }}
    >
      {urgentCount > 0 && (
        <div style={{ position: 'absolute', top: 3, right: 3, zIndex: 2, background: '#ef4444', borderRadius: '50%', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: '#fff' }}>{urgentCount}</div>
      )}
      {hasItems ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignContent: 'flex-start' }}>
          {items.map((item, i) => {
            const cat = getCat(item.category)
            return (
              <div key={item.id || i} title={item.name} style={{ background: `${cat.color}22`, border: `1px solid ${cat.color}66`, borderRadius: 5, padding: '2px 5px', display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 11 }}>{cat.emoji}</span>
                <span style={{ fontSize: 9, color: '#374151', fontWeight: 600, maxWidth: 42, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
              </div>
            )
          })}
          <div style={{ border: `1px dashed ${isFreezer ? '#93c5fd' : '#d4a96a'}`, borderRadius: 5, padding: '2px 6px', fontSize: 10, color: isFreezer ? '#93c5fd' : '#d4a96a', display: 'flex', alignItems: 'center' }}>+</div>
        </div>
      ) : (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isFreezer ? '#bfdbfe' : '#e5c99a', fontSize: 18 }}>+</div>
      )}
    </div>
  )
}

/* ---------- 식재료 입력 폼 ---------- */
function ItemForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [category, setCategory] = useState(initial?.category || 'other')
  const [quantity, setQuantity] = useState(initial?.quantity ?? '')
  const [unit, setUnit] = useState(initial?.unit || '개')
  const [expiry, setExpiry] = useState(initial?.expiry || '')
  const [error, setError] = useState('')

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('이름을 입력해 주세요.'); return }
    const q = String(quantity).trim()
    if (q && !Number.isFinite(Number(q))) { setError('수량은 숫자로 입력해 주세요.'); return }
    if (expiry && !parseDateOnly(expiry)) { setError('유통기한 날짜를 확인해 주세요.'); return }
    setError('')
    onSave({ name: trimmed, category, quantity: q, unit, expiry })
  }
  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input placeholder="식재료 이름" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} style={inp} autoFocus />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
          {CATEGORIES.map(c => (
            <button key={c.id} type="button" onClick={() => setCategory(c.id)} style={{ padding: '5px 3px', borderRadius: 7, border: `1.5px solid ${category === c.id ? c.color : '#e5e7eb'}`, background: category === c.id ? `${c.color}22` : '#fff', color: category === c.id ? c.color : '#9ca3af', fontSize: 10, fontWeight: 600, cursor: 'pointer', transition: 'all 0.13s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: 14 }}>{c.emoji}</span>{c.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input placeholder="수량" inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} style={{ ...inp, flex: 2 }} />
          <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, flex: 1 }}>
            {['g','kg','개','팩','봉','L','ml','병','캔'].map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label style={{ color: '#6b7280', fontSize: 11, display: 'block', marginBottom: 3 }}>유통기한 (선택)</label>
          <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} style={inp} />
        </div>
        {error && <div role="alert" style={{ color: '#dc2626', fontSize: 11.5, fontWeight: 600 }}>⚠️ {error}</div>}
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={onCancel} style={{ ...btn, flex: 1 }}>취소</button>
          <button type="button" onClick={handleSave} style={{ ...btn, flex: 2, border: 'none', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff' }}>확인</button>
        </div>
      </div>
    </div>
  )
}

/* ---------- 칸 상세(편집) 모달 ---------- */
function SlotModal({ sectionId, slotIdx, slot, focusIndex = null, onClose, onUpdate }) {
  const [items, setItems] = useState(() => (Array.isArray(slot.items) ? slot.items : []))
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(
    typeof focusIndex === 'number' && focusIndex >= 0 && focusIndex < (slot.items || []).length ? focusIndex : null
  )
  const [changed, setChanged] = useState(false)

  const handleSave = () => { onUpdate(sectionId, slotIdx, items); onClose() }
  const addItem = item => { setItems(prev => [...prev, { ...item, id: newItemId() }]); setAdding(false); setChanged(true) }
  const updateItem = (idx, item) => { setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...item } : it)); setEditing(null); setChanged(true) }
  const removeItem = idx => { setItems(prev => prev.filter((_, i) => i !== idx)); setEditing(null); setChanged(true) }
  const editingItem = editing !== null && items[editing] ? items[editing] : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)', padding: 12 }}>
      <div style={{ background: '#fff', borderRadius: 22, width: 'min(360px,94vw)', maxHeight: '88vh', border: '1px solid #e5e7eb', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#f9fafb' }}>
          <div>
            <div style={{ color: '#111827', fontWeight: 700, fontSize: 15 }}>{SLOT_LABELS[sectionId] || sectionId} · {slotIdx + 1}번 칸</div>
            <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>{items.length}개 식재료</div>
          </div>
          <button type="button" onClick={() => { setAdding(true); setEditing(null) }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ 추가</button>
        </div>
        {(adding || editingItem) && <div style={{ flexShrink: 0 }}><ItemForm initial={editingItem} onSave={item => editingItem ? updateItem(editing, item) : addItem(item)} onCancel={() => { setAdding(false); setEditing(null) }} /></div>}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
          {items.length === 0 && !adding ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
              <div style={{ fontSize: 13 }}>비어있어요. 추가해보세요!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {items.map((item, idx) => {
                const cat = getCat(item.category)
                const d = daysUntil(item.expiry)
                const ec = expiryColor(d)
                return (
                  <div key={item.id || idx} style={{ background: `${cat.color}11`, border: `1px solid ${cat.color}44`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{cat.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ color: '#111827', fontWeight: 700, fontSize: 13 }}>{item.name}</span>
                        <span style={{ color: cat.color, fontSize: 10, fontWeight: 600 }}>{cat.label}</span>
                        {ec && <span style={{ background: ec, color: '#fff', borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 800 }}>{dLabel(d)}</span>}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>{item.quantity !== '' && item.quantity != null && `${item.quantity}${item.unit || ''}`}{item.expiry && ` · ${item.expiry}`}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button type="button" aria-label={`${item.name} 수정`} onClick={() => { setEditing(idx); setAdding(false) }} style={iconBtn}>✏️</button>
                      <button type="button" aria-label={`${item.name} 삭제`} onClick={() => removeItem(idx)} style={iconBtn}>🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, flexShrink: 0, background: '#f9fafb' }}>
          <button type="button" onClick={onClose} style={{ ...btn, flex: 1 }}>취소</button>
          <button type="button" onClick={handleSave} style={{ ...btn, flex: 2, border: 'none', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff' }}>{changed ? '저장' : '저장하고 닫기'}</button>
        </div>
      </div>
    </div>
  )
}

function extractRecipeText(data) {
  if (!data) return ''
  if (typeof data === 'string') return data.trim()
  if (typeof data.text === 'string') return data.text.trim()
  if (typeof data.recipe === 'string') return data.recipe.trim()
  if (Array.isArray(data.content)) {
    return data.content.map(b => (typeof b === 'string' ? b : b?.text || '')).filter(Boolean).join('\n').trim()
  }
  return ''
}

// 레시피 서버(프록시) 주소. 설정하지 않으면 네트워크 요청 없이 기본 조합만 보여줍니다.
const recipeApiUrl = String(import.meta.env.VITE_RECIPE_API_URL || '').trim()

function LocalRecipeView({ items }) {
  const recipes = buildLocalRecipes(items)
  const urgent = items
    .map(i => ({ ...i, d: daysUntil(i.expiry) }))
    .filter(i => i.d !== null && i.d <= URGENT_DAYS)
    .sort((a, b) => a.d - b.d)
  return (
    <div>
      {urgent.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '9px 11px', marginBottom: 12 }}>
          <div style={{ color: '#b91c1c', fontSize: 11.5, fontWeight: 800, marginBottom: 4 }}>⏰ 먼저 써야 할 재료</div>
          <div style={{ color: '#7f1d1d', fontSize: 11.5, lineHeight: 1.6 }}>{urgent.map(i => `${i.name}(${dLabel(i.d)})`).join(' · ')}</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {recipes.map((r, idx) => (
          <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '11px 13px', background: '#fbfdff' }}>
            <div style={{ color: '#1d4ed8', fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>{idx + 1}. {r.title}</div>
            <div style={{ color: '#6b7280', fontSize: 11.5, marginBottom: 6 }}>사용 재료: {r.uses.join(', ') || '냉장고 재료'}</div>
            <ol style={{ margin: 0, paddingLeft: 18, color: '#374151', fontSize: 12, lineHeight: 1.75 }}>
              {r.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- 레시피 모달 ---------- */
function RecipeModal({ allItems, onClose }) {
  const [mode, setMode] = useState(recipeApiUrl ? 'remote' : 'local')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(Boolean(recipeApiUrl))
  const [error, setError] = useState('')

  const fetchRecipe = useCallback(async () => {
    if (!recipeApiUrl) { setMode('local'); setLoading(false); return }
    setLoading(true); setText(''); setError('')
    try {
      const res = await fetch(recipeApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: allItems.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit, category: i.category, expiry: i.expiry })),
        }),
      })
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) throw new Error('레시피 서버가 요청을 거부했어요. 서버 쪽 API 키 설정을 확인해 주세요.')
        if (res.status === 404) throw new Error('레시피 서버 주소를 찾을 수 없어요. VITE_RECIPE_API_URL 값을 확인해 주세요.')
        if (res.status >= 500) throw new Error('레시피 서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.')
        throw new Error(`레시피를 불러오지 못했어요 (HTTP ${res.status}).`)
      }
      const data = await res.json().catch(() => null)
      const body = extractRecipeText(data)
      if (!body) throw new Error('레시피 서버가 빈 응답을 보냈어요.')
      setText(body)
    } catch (err) {
      const isNetwork = err instanceof TypeError
      setError(isNetwork
        ? '레시피 서버에 연결할 수 없어요. 네트워크나 VITE_RECIPE_API_URL 설정을 확인해 주세요.'
        : (err?.message || '레시피를 불러오지 못했어요.'))
    } finally {
      setLoading(false)
    }
  }, [allItems])

  useEffect(() => { if (recipeApiUrl) fetchRecipe() }, []) // 최초 1회만 자동 요청

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)', padding: 12 }}>
      <div style={{ background: '#fff', borderRadius: 22, padding: 24, width: 'min(480px,95vw)', maxHeight: '84vh', border: '1px solid #e5e7eb', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
          <h3 style={{ margin: 0, color: '#111827', fontSize: 17 }}>🍳 레시피 추천</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {mode === 'local' && recipeApiUrl && (
              <button type="button" onClick={() => { setMode('remote'); fetchRecipe() }} style={{ ...btn, padding: '5px 12px', fontSize: 11 }}>AI로 시도</button>
            )}
            {mode === 'remote' && (
              <button type="button" onClick={() => fetchRecipe()} style={{ ...btn, padding: '5px 12px', fontSize: 11 }}>🔄 다시</button>
            )}
          </div>
        </div>

        {mode === 'local' && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 9, padding: '8px 11px', marginBottom: 12, color: '#1e40af', fontSize: 11.5, lineHeight: 1.55 }}>
            냉장고 재료로 만든 기본 조합이에요. AI 추천을 쓰려면 배포 환경에 레시피 프록시 주소(<b>VITE_RECIPE_API_URL</b>)를 설정해 주세요. (키는 브라우저가 아니라 서버에 둡니다.)
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', color: '#374151', fontSize: 13, lineHeight: 1.85 }}>
          {mode === 'remote' && loading && (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🤔</div>
              레시피 생각 중…
            </div>
          )}
          {mode === 'remote' && !loading && error && (
            <div>
              <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px', color: '#b91c1c', fontSize: 12, lineHeight: 1.6 }}>
                ⚠️ {error}
              </div>
              <button type="button" onClick={() => setMode('local')} style={{ ...btn, marginTop: 10, width: '100%' }}>기본 조합 보기</button>
            </div>
          )}
          {mode === 'remote' && !loading && !error && (
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{text}</pre>
          )}
          {mode === 'local' && <LocalRecipeView items={allItems} />}
        </div>

        <button type="button" onClick={onClose} style={{ ...btn, marginTop: 16, border: 'none', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff' }}>닫기</button>
      </div>
    </div>
  )
}

/* ---------- 검색/임박 목록 한 줄 ---------- */
function EntryRow({ entry, onPick }) {
  const cat = getCat(entry.item.category)
  const color = expiryColor(entry.days)
  return (
    <button
      type="button"
      onClick={() => onPick(entry)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 9, padding: '7px 9px', cursor: 'pointer' }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{cat.emoji}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', color: '#111827', fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.item.name}</span>
        <span style={{ display: 'block', color: '#6b7280', fontSize: 10.5, marginTop: 1 }}>
          {entry.sectionLabel} · {entry.slotIdx + 1}번 칸
          {entry.item.quantity !== '' && entry.item.quantity != null ? ` · ${entry.item.quantity}${entry.item.unit || ''}` : ''}
        </span>
      </span>
      {entry.days !== null && (
        <span style={{ background: color, color: '#fff', borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{dLabel(entry.days)}</span>
      )}
      <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>✏️</span>
    </button>
  )
}

function SyncBadge({ status }) {
  const map = {
    loading: { color: '#3b82f6', label: '불러오는 중…' },
    saving:  { color: '#f59e0b', label: '저장 중…' },
    synced:  { color: '#22c55e', label: '실시간 동기화 중' },
    error:   { color: '#ef4444', label: '오프라인 모드' },
  }
  const cfg = map[status] || map.synced
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, boxShadow: `0 0 5px ${cfg.color}`, animation: status !== 'synced' ? 'pulse 1s infinite' : 'none' }} />
      <span style={{ color: cfg.color, fontSize: 11 }}>{cfg.label}</span>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  )
}

export default function App() {
  const [sections, setSections] = useState(INITIAL_SECTIONS)
  const [syncStatus, setSyncStatus] = useState('loading')
  const [saveError, setSaveError] = useState('')
  const [slotModal, setSlotModal] = useState(null)
  const [recipe, setRecipe] = useState(false)
  const [query, setQuery] = useState('')
  const [showUrgent, setShowUrgent] = useState(false)
  const isSaving = useRef(false)
  const sectionsRef = useRef(sections)
  const searchRef = useRef(null)

  // 상태를 한 곳에서 갱신해 저장·실시간 수신이 서로 덮어쓰지 않게 합니다.
  const applySections = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(sectionsRef.current) : updater
    sectionsRef.current = next
    setSections(next)
    return next
  }, [])

  const persist = useCallback(async (next) => {
    if (!supabase) {
      setSyncStatus('error')
      setSaveError('Supabase 연결 정보가 없어 변경 내용이 저장되지 않았어요. .env의 VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY를 확인해 주세요.')
      return false
    }
    isSaving.current = true
    setSyncStatus('saving')
    try {
      const { error } = await supabase
        .from('fridges')
        .upsert({ id: FRIDGE_ID, sections: next, updated_at: new Date().toISOString() })
      if (error) throw error
      setSyncStatus('synced')
      setSaveError('')
      return true
    } catch (err) {
      console.error('저장 실패', err)
      setSyncStatus('error')
      setSaveError('저장에 실패했어요. 화면의 내용은 유지되지만 새로고침하면 사라질 수 있어요.')
      return false
    } finally {
      isSaving.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!supabase) {
      setSyncStatus('error')
      setSaveError('Supabase 연결 정보가 없어 오프라인으로 동작해요. .env의 VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY를 확인해 주세요.')
      return
    }
    setSyncStatus('loading')
    try {
      const { data, error } = await supabase.from('fridges').select('sections').eq('id', FRIDGE_ID).maybeSingle()
      if (error) throw error
      if (data?.sections) applySections(() => migrateSections(data.sections))
      setSyncStatus('synced')
      setSaveError('')
    } catch (err) {
      console.error('불러오기 실패', err)
      setSyncStatus('error')
      setSaveError('냉장고 데이터를 불러오지 못했어요. 네트워크와 Supabase 테이블 · 권한을 확인해 주세요.')
    }
  }, [applySections])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!supabase) return undefined
    const channel = supabase.channel('fridge-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fridges', filter: `id=eq.${FRIDGE_ID}` },
        (payload) => {
          if (isSaving.current) return
          if (payload?.new?.sections) applySections(() => migrateSections(payload.new.sections))
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [applySections])

  const updateSlot = useCallback((sectionId, slotIdx, items) => {
    const next = applySections(prev => {
      const sec = prev[sectionId] || { label: SLOT_LABELS[sectionId] || sectionId, type: 'fridge', slots: [] }
      const slots = Array.isArray(sec.slots) ? sec.slots : []
      return { ...prev, [sectionId]: { ...sec, slots: slots.map((s, i) => i === slotIdx ? { items } : s) } }
    })
    persist(next)
  }, [applySections, persist])

  const resetAll = () => {
    if (!window.confirm('모든 데이터를 초기화할까요?')) return
    const next = applySections(() => buildInitialSections())
    setQuery('')
    setShowUrgent(false)
    persist(next)
  }

  const entries = useMemo(() => collectEntries(sections), [sections])
  const trimmedQuery = query.trim()
  const searchResults = useMemo(() => filterEntries(entries, query), [entries, query])
  const highlightedSlots = useMemo(
    () => new Set(searchResults.map(e => `${e.sectionId}:${e.slotIdx}`)),
    [searchResults]
  )
  const urgentEntries = useMemo(() => collectUrgent(entries), [entries])
  const expiredCount = urgentEntries.filter(e => e.days < 0).length
  const soonCount = urgentEntries.length - expiredCount

  const openEntry = (entry) => setSlotModal({ sectionId: entry.sectionId, slotIdx: entry.slotIdx, focusIndex: entry.itemIndex })

  const renderSection = (sectionId, isFreezer) => {
    const sec = sections[sectionId]
    if (!sec) return null
    const slots = Array.isArray(sec.slots) ? sec.slots : []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        {slots.map((slot, idx) => (
          <SlotPanel
            key={idx}
            slot={slot}
            sectionId={sectionId}
            slotIdx={idx}
            isFreezer={isFreezer}
            onOpenSlot={setSlotModal}
            highlighted={highlightedSlots.has(`${sectionId}:${idx}`)}
          />
        ))}
      </div>
    )
  }

  const totalItems = entries.length

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #fef9f0 0%, #f0f7ff 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', padding: '28px 16px 48px',
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: '#1f2937' }}>
          🧊 냉장고 식재료 관리
        </h1>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: '#6b7280', fontSize: 12 }}>
            총 {totalItems}개 보관 중
            {urgentEntries.length > 0 && <span style={{ color: '#ef4444', marginLeft: 6 }}>⚠️ {urgentEntries.length}개 임박</span>}
          </span>
          <SyncBadge status={syncStatus} />
        </div>
      </div>

      {/* 검색 · 유통기한 한눈에 보기 */}
      <div style={{ width: 'min(420px,96vw)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '4px 10px', boxShadow: '0 4px 14px rgba(15,23,42,0.05)' }}>
          <span style={{ fontSize: 14, color: '#9ca3af' }}>🔍</span>
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="식재료 이름 · 카테고리로 검색"
            aria-label="식재료 검색"
            style={{ flex: 1, border: 'none', outline: 'none', padding: '6px 0', fontSize: 13, background: 'transparent', color: '#1f2937', minWidth: 0 }}
          />
          {query && (
            <button type="button" aria-label="검색어 지우기" onClick={() => { setQuery(''); searchRef.current?.focus() }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, padding: '2px 4px' }}>✕</button>
          )}
        </div>

        <button
          type="button"
          onClick={() => { setShowUrgent(v => !v); setQuery('') }}
          aria-expanded={showUrgent && !trimmedQuery}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
            border: `1px solid ${urgentEntries.length ? '#fca5a5' : '#e5e7eb'}`,
            background: showUrgent && !trimmedQuery ? '#fef2f2' : urgentEntries.length ? '#fff5f5' : '#fff',
            color: urgentEntries.length ? '#dc2626' : '#6b7280', fontSize: 12, fontWeight: 800,
          }}
        >
          ⏰ 만료 {expiredCount} · 임박 {soonCount}
          <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.75 }}>{showUrgent && !trimmedQuery ? '닫기' : '보기'}</span>
        </button>

        {trimmedQuery && (
          <div style={cardStyle}>
            <div style={{ padding: '9px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: '#374151', fontWeight: 800 }}>🔍 ‘{trimmedQuery}’ 검색 결과 {searchResults.length}개</span>
              <button type="button" onClick={() => setQuery('')} style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: 11, cursor: 'pointer' }}>닫기</button>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '22px 8px', color: '#9ca3af', fontSize: 12, lineHeight: 1.7 }}>
                  찾는 식재료가 없어요.<br />이름이나 카테고리(육류 · 채소 · 유제품 …)로 검색해 보세요.
                </div>
              ) : searchResults.map(entry => <EntryRow key={entry.key} entry={entry} onPick={openEntry} />)}
            </div>
          </div>
        )}

        {!trimmedQuery && showUrgent && (
          <div style={cardStyle}>
            <div style={{ padding: '9px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: '#b91c1c', fontWeight: 800 }}>⏰ 유통기한 임박 · 만료 {urgentEntries.length}개</span>
              <button type="button" onClick={() => setShowUrgent(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: 11, cursor: 'pointer' }}>닫기</button>
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {urgentEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '22px 8px', color: '#9ca3af', fontSize: 12, lineHeight: 1.7 }}>
                  D-{URGENT_DAYS} 이내이거나 만료된 재료가 없어요. 👍
                </div>
              ) : (
                <>
                  <div style={{ color: '#9ca3af', fontSize: 10.5, padding: '0 2px 2px' }}>만료된 재료부터 보여드려요. 누르면 해당 칸을 바로 수정할 수 있어요.</div>
                  {urgentEntries.map(entry => <EntryRow key={entry.key} entry={entry} onPick={openEntry} />)}
                </>
              )}
            </div>
          </div>
        )}

        {saveError && (
          <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '9px 11px', color: '#92400e', fontSize: 11.5, lineHeight: 1.6 }}>
            <span style={{ flex: 1 }}>⚠️ {saveError}</span>
            <button type="button" onClick={() => persist(sectionsRef.current)} style={{ border: '1px solid #fcd34d', background: '#fff', color: '#92400e', borderRadius: 7, padding: '3px 8px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>다시 시도</button>
          </div>
        )}
      </div>

      {/* 냉장고 본체 */}
      <div style={{ width: 'min(360px,96vw)', background: '#e8e0d8', borderRadius: 28, border: '3px solid #c8bdb0', boxShadow: '0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.6)', overflow: 'hidden' }}>

        {/* 냉장 - 베이지 */}
        <div style={{ borderBottom: '4px solid #c8bdb0', background: 'linear-gradient(180deg,#fdf6ec 0%,#faecd8 100%)' }}>
          <div style={{ padding: '10px 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8d5b7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 6px #3b82f6' }} />
              <span style={{ color: '#92600a', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>REFRIGERATOR</span>
            </div>
            <span style={{ color: '#c4965a', fontSize: 11 }}>2°C ~ 5°C</span>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ flex: 1, padding: '10px 7px 10px 10px', borderRight: '3px solid #c8bdb0' }}>
              <div style={{ color: '#c4965a', fontSize: 9, fontWeight: 700, letterSpacing: 1, marginBottom: 6, textAlign: 'center' }}>LEFT · 4칸</div>
              {renderSection('fridge_left', false)}
            </div>
            <div style={{ flex: 1, padding: '10px 10px 10px 7px' }}>
              <div style={{ color: '#c4965a', fontSize: 9, fontWeight: 700, letterSpacing: 1, marginBottom: 6, textAlign: 'center' }}>RIGHT · 4칸</div>
              {renderSection('fridge_right', false)}
            </div>
          </div>
        </div>

        {/* 구분 */}
        <div style={{ height: 18, background: '#c8bdb0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          {[...Array(8)].map((_, i) => <div key={i} style={{ width: 14, height: 3, borderRadius: 2, background: '#b0a498' }} />)}
        </div>

        {/* 냉동 - 하늘색 */}
        <div style={{ background: 'linear-gradient(180deg,#eff8ff 0%,#dbeafe 100%)' }}>
          <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #bfdbfe' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#818cf8', boxShadow: '0 0 6px #818cf8' }} />
              <span style={{ color: '#1d4ed8', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>FREEZER</span>
            </div>
            <span style={{ color: '#60a5fa', fontSize: 11 }}>-18°C</span>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ flex: 1, padding: '10px 7px 12px 10px', borderRight: '3px solid #c8bdb0' }}>
              <div style={{ color: '#60a5fa', fontSize: 9, fontWeight: 700, letterSpacing: 1, marginBottom: 6, textAlign: 'center' }}>LEFT · 3칸</div>
              {renderSection('freeze_left', true)}
            </div>
            <div style={{ flex: 1, padding: '10px 10px 12px 7px' }}>
              <div style={{ color: '#60a5fa', fontSize: 9, fontWeight: 700, letterSpacing: 1, marginBottom: 6, textAlign: 'center' }}>RIGHT · 3칸</div>
              {renderSection('freeze_right', true)}
            </div>
          </div>
        </div>

        {/* 손잡이 */}
        <div style={{ padding: '8px 14px 12px', background: '#c8bdb0', display: 'flex', justifyContent: 'center', gap: 10 }}>
          <div style={{ width: 70, height: 5, borderRadius: 3, background: '#b0a498', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }} />
          <div style={{ width: 70, height: 5, borderRadius: 3, background: '#b0a498', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        {totalItems > 0 && (
          <button type="button" onClick={() => setRecipe(true)} style={{ ...btn, background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', color: '#16a34a', border: '1px solid #86efac', padding: '9px 20px' }}>
            🍳 레시피 추천
          </button>
        )}
        <button type="button" style={{ ...btn, color: '#9ca3af', padding: '9px 20px', fontSize: 11 }} onClick={resetAll}>
          초기화
        </button>
      </div>
      <p style={{ color: '#9ca3af', fontSize: 11, marginTop: 12, textAlign: 'center' }}>
        칸을 클릭해 식재료를 추가 / 수정 / 삭제하세요
      </p>

      {slotModal && sections[slotModal.sectionId]?.slots?.[slotModal.slotIdx] && (
        <SlotModal
          sectionId={slotModal.sectionId}
          slotIdx={slotModal.slotIdx}
          slot={sections[slotModal.sectionId].slots[slotModal.slotIdx]}
          focusIndex={slotModal.focusIndex}
          onClose={() => setSlotModal(null)}
          onUpdate={updateSlot}
        />
      )}
      {recipe && <RecipeModal allItems={entries.map(e => e.item)} onClose={() => setRecipe(false)} />}
    </div>
  )
}
