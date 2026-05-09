import { useState, useEffect, useCallback, useRef } from ‘react’
import { supabase } from ‘./supabase.js’

const FRIDGE_ID = ‘my-fridge’

const makeSlot = () => ({ items: [] })
const INITIAL_SECTIONS = {
fridge_left:  { label: ‘냉장 좌’, type: ‘fridge’, slots: [makeSlot(),makeSlot(),makeSlot(),makeSlot()] },
fridge_right: { label: ‘냉장 우’, type: ‘fridge’, slots: [makeSlot(),makeSlot(),makeSlot(),makeSlot()] },
freeze_left:  { label: ‘냉동 좌’, type: ‘freeze’, slots: [makeSlot(),makeSlot(),makeSlot()] },
freeze_right: { label: ‘냉동 우’, type: ‘freeze’, slots: [makeSlot(),makeSlot(),makeSlot()] },
}

const CATEGORIES = [
{ id: ‘meat’,      emoji: ‘🥩’, label: ‘육류’,   color: ‘#ef4444’ },
{ id: ‘seafood’,   emoji: ‘🐟’, label: ‘해산물’, color: ‘#3b82f6’ },
{ id: ‘veggie’,    emoji: ‘🥦’, label: ‘채소’,   color: ‘#22c55e’ },
{ id: ‘dairy’,     emoji: ‘🥛’, label: ‘유제품’, color: ‘#f59e0b’ },
{ id: ‘banchan’,   emoji: ‘🍽️’, label: ‘반찬’,   color: ‘#ec4899’ },
{ id: ‘soup’,      emoji: ‘🍜’, label: ‘국’,     color: ‘#f97316’ },
{ id: ‘jjigae’,   emoji: ‘🫕’, label: ‘찌개’,   color: ‘#dc2626’ },
{ id: ‘drink’,     emoji: ‘🧃’, label: ‘음료’,   color: ‘#10b981’ },
{ id: ‘alcohol’,   emoji: ‘🍺’, label: ‘주류’,   color: ‘#d97706’ },
{ id: ‘processed’, emoji: ‘🍱’, label: ‘가공’,   color: ‘#8b5cf6’ },
{ id: ‘other’,     emoji: ‘📦’, label: ‘기타’,   color: ‘#6b7280’ },
]

const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1]

function daysUntil(dateStr) {
if (!dateStr) return null
return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}
function expiryColor(dateStr) {
const d = daysUntil(dateStr)
if (d === null) return null
if (d < 0)  return ‘#9ca3af’
if (d <= 2) return ‘#ef4444’
if (d <= 7) return ‘#f59e0b’
return ‘#22c55e’
}
function migrateSections(raw) {
if (!raw) return INITIAL_SECTIONS
const out = {}
for (const [key, sec] of Object.entries(raw)) {
out[key] = { …sec, slots: (sec.slots || []).map(s => (!s || !s.items) ? makeSlot() : s) }
}
for (const key of Object.keys(INITIAL_SECTIONS)) {
if (!out[key]) out[key] = INITIAL_SECTIONS[key]
}
return out
}

const inp = {
width: ‘100%’, padding: ‘9px 12px’, borderRadius: 9, border: ‘1px solid #d1d5db’,
background: ‘#fff’, color: ‘#1f2937’, fontSize: 13, outline: ‘none’, boxSizing: ‘border-box’,
}
const btn = {
padding: ‘9px 16px’, borderRadius: 9, border: ‘1px solid #d1d5db’,
background: ‘#f9fafb’, color: ‘#374151’, fontSize: 13, fontWeight: 600,
cursor: ‘pointer’, transition: ‘all 0.15s’,
}
const iconBtn = { background: ‘transparent’, border: ‘none’, cursor: ‘pointer’, fontSize: 15, padding: ‘3px 5px’, borderRadius: 6 }
const SLOT_LABELS = { fridge_left:‘냉장 좌’, fridge_right:‘냉장 우’, freeze_left:‘냉동 좌’, freeze_right:‘냉동 우’ }

function SlotPanel({ slot, sectionId, slotIdx, isFreezer, onOpenSlot }) {
const items = slot.items || []
const hasItems = items.length > 0
const urgentCount = items.filter(i => { const d = daysUntil(i.expiry); return d !== null && d >= 0 && d <= 3 }).length
return (
<div
onClick={() => onOpenSlot({ sectionId, slotIdx })}
style={{
flex: 1, borderRadius: 8, position: ‘relative’, overflow: ‘hidden’,
border: hasItems ? `1.5px solid ${isFreezer ? '#93c5fd' : '#d4a96a'}` : `1.5px dashed ${isFreezer ? '#bfdbfe' : '#e5c99a'}`,
background: isFreezer
? hasItems ? ‘rgba(219,234,254,0.5)’ : ‘rgba(239,246,255,0.4)’
: hasItems ? ‘rgba(254,243,219,0.6)’ : ‘rgba(255,249,235,0.4)’,
cursor: ‘pointer’, padding: 5, transition: ‘background 0.18s’,
minHeight: isFreezer ? 80 : 72,
}}
onMouseEnter={e => { e.currentTarget.style.background = isFreezer ? ‘rgba(219,234,254,0.8)’ : ‘rgba(254,243,219,0.9)’ }}
onMouseLeave={e => { e.currentTarget.style.background = isFreezer ? (hasItems ? ‘rgba(219,234,254,0.5)’ : ‘rgba(239,246,255,0.4)’) : (hasItems ? ‘rgba(254,243,219,0.6)’ : ‘rgba(255,249,235,0.4)’) }}
>
{urgentCount > 0 && (
<div style={{ position: ‘absolute’, top: 3, right: 3, zIndex: 2, background: ‘#ef4444’, borderRadius: ‘50%’, width: 15, height: 15, display: ‘flex’, alignItems: ‘center’, justifyContent: ‘center’, fontSize: 8, fontWeight: 800, color: ‘#fff’ }}>{urgentCount}</div>
)}
{hasItems ? (
<div style={{ display: ‘flex’, flexWrap: ‘wrap’, gap: 3, alignContent: ‘flex-start’ }}>
{items.map((item, i) => {
const cat = getCat(item.category)
return (
<div key={i} title={item.name} style={{ background: `${cat.color}22`, border: `1px solid ${cat.color}66`, borderRadius: 5, padding: ‘2px 5px’, display: ‘flex’, alignItems: ‘center’, gap: 2 }}>
<span style={{ fontSize: 11 }}>{cat.emoji}</span>
<span style={{ fontSize: 9, color: ‘#374151’, fontWeight: 600, maxWidth: 42, overflow: ‘hidden’, textOverflow: ‘ellipsis’, whiteSpace: ‘nowrap’ }}>{item.name}</span>
</div>
)
})}
<div style={{ border: `1px dashed ${isFreezer ? '#93c5fd' : '#d4a96a'}`, borderRadius: 5, padding: ‘2px 6px’, fontSize: 10, color: isFreezer ? ‘#93c5fd’ : ‘#d4a96a’, display: ‘flex’, alignItems: ‘center’ }}>+</div>
</div>
) : (
<div style={{ height: ‘100%’, display: ‘flex’, alignItems: ‘center’, justifyContent: ‘center’, color: isFreezer ? ‘#bfdbfe’ : ‘#e5c99a’, fontSize: 18 }}>+</div>
)}
</div>
)
}

function ItemForm({ initial, onSave, onCancel }) {
const [name, setName] = useState(initial?.name || ‘’)
const [category, setCategory] = useState(initial?.category || ‘other’)
const [quantity, setQuantity] = useState(initial?.quantity || ‘’)
const [unit, setUnit] = useState(initial?.unit || ‘개’)
const [expiry, setExpiry] = useState(initial?.expiry || ‘’)
const handleSave = () => { if (!name.trim()) return; onSave({ name: name.trim(), category, quantity, unit, expiry }) }
return (
<div style={{ padding: ‘14px 16px’, borderBottom: ‘1px solid #e5e7eb’, background: ‘#f9fafb’ }}>
<div style={{ display: ‘flex’, flexDirection: ‘column’, gap: 10 }}>
<input placeholder=“식재료 이름” value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === ‘Enter’ && handleSave()} style={inp} autoFocus />
<div style={{ display: ‘grid’, gridTemplateColumns: ‘repeat(4,1fr)’, gap: 5 }}>
{CATEGORIES.map(c => (
<button key={c.id} onClick={() => setCategory(c.id)} style={{ padding: ‘5px 3px’, borderRadius: 7, border: `1.5px solid ${category === c.id ? c.color : '#e5e7eb'}`, background: category === c.id ? `${c.color}22` : ‘#fff’, color: category === c.id ? c.color : ‘#9ca3af’, fontSize: 10, fontWeight: 600, cursor: ‘pointer’, transition: ‘all 0.13s’, display: ‘flex’, flexDirection: ‘column’, alignItems: ‘center’, gap: 1 }}>
<span style={{ fontSize: 14 }}>{c.emoji}</span>{c.label}
</button>
))}
</div>
<div style={{ display: ‘flex’, gap: 6 }}>
<input placeholder=“수량” value={quantity} onChange={e => setQuantity(e.target.value)} style={{ …inp, flex: 2 }} />
<select value={unit} onChange={e => setUnit(e.target.value)} style={{ …inp, flex: 1 }}>
{[‘g’,‘kg’,‘개’,‘팩’,‘봉’,‘L’,‘ml’,‘병’,‘캔’].map(u => <option key={u}>{u}</option>)}
</select>
</div>
<div>
<label style={{ color: ‘#6b7280’, fontSize: 11, display: ‘block’, marginBottom: 3 }}>유통기한</label>
<input type=“date” value={expiry} onChange={e => setExpiry(e.target.value)} style={inp} />
</div>
<div style={{ display: ‘flex’, gap: 6 }}>
<button onClick={onCancel} style={{ …btn, flex: 1 }}>취소</button>
<button onClick={handleSave} style={{ …btn, flex: 2, border: ‘none’, background: ‘linear-gradient(135deg,#3b82f6,#6366f1)’, color: ‘#fff’ }}>확인</button>
</div>
</div>
</div>
)
}

function SlotModal({ sectionId, slotIdx, slot, onClose, onUpdate }) {
const [items, setItems] = useState(slot.items || [])
const [adding, setAdding] = useState(false)
const [editing, setEditing] = useState(null)
const handleSave = () => { onUpdate(sectionId, slotIdx, items); onClose() }
const addItem = item => { setItems(prev => […prev, { …item, id: Date.now() }]); setAdding(false) }
const updateItem = (idx, item) => { setItems(prev => prev.map((it, i) => i === idx ? { …it, …item } : it)); setEditing(null) }
const removeItem = idx => setItems(prev => prev.filter((_, i) => i !== idx))
return (
<div style={{ position: ‘fixed’, inset: 0, background: ‘rgba(0,0,0,0.5)’, display: ‘flex’, alignItems: ‘center’, justifyContent: ‘center’, zIndex: 200, backdropFilter: ‘blur(4px)’ }}>
<div style={{ background: ‘#fff’, borderRadius: 22, width: ‘min(360px,94vw)’, maxHeight: ‘88vh’, border: ‘1px solid #e5e7eb’, boxShadow: ‘0 20px 60px rgba(0,0,0,0.15)’, display: ‘flex’, flexDirection: ‘column’, overflow: ‘hidden’ }}>
<div style={{ padding: ‘16px 18px 12px’, borderBottom: ‘1px solid #e5e7eb’, display: ‘flex’, justifyContent: ‘space-between’, alignItems: ‘center’, flexShrink: 0, background: ‘#f9fafb’ }}>
<div>
<div style={{ color: ‘#111827’, fontWeight: 700, fontSize: 15 }}>{SLOT_LABELS[sectionId]} · {slotIdx + 1}번 칸</div>
<div style={{ color: ‘#6b7280’, fontSize: 11, marginTop: 2 }}>{items.length}개 식재료</div>
</div>
<button onClick={() => { setAdding(true); setEditing(null) }} style={{ padding: ‘6px 14px’, borderRadius: 8, border: ‘none’, background: ‘linear-gradient(135deg,#3b82f6,#6366f1)’, color: ‘#fff’, fontSize: 12, fontWeight: 700, cursor: ‘pointer’ }}>+ 추가</button>
</div>
{(adding || editing !== null) && <div style={{ flexShrink: 0 }}><ItemForm initial={editing !== null ? items[editing] : null} onSave={item => editing !== null ? updateItem(editing, item) : addItem(item)} onCancel={() => { setAdding(false); setEditing(null) }} /></div>}
<div style={{ flex: 1, overflowY: ‘auto’, padding: ‘10px 16px’ }}>
{items.length === 0 && !adding ? (
<div style={{ textAlign: ‘center’, padding: ‘40px 0’, color: ‘#9ca3af’ }}>
<div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
<div style={{ fontSize: 13 }}>비어있어요. 추가해보세요!</div>
</div>
) : (
<div style={{ display: ‘flex’, flexDirection: ‘column’, gap: 7 }}>
{items.map((item, idx) => {
const cat = getCat(item.category)
const d = daysUntil(item.expiry)
const ec = expiryColor(item.expiry)
return (
<div key={item.id || idx} style={{ background: `${cat.color}11`, border: `1px solid ${cat.color}44`, borderRadius: 10, padding: ‘10px 12px’, display: ‘flex’, alignItems: ‘center’, gap: 10 }}>
<span style={{ fontSize: 22, flexShrink: 0 }}>{cat.emoji}</span>
<div style={{ flex: 1, minWidth: 0 }}>
<div style={{ display: ‘flex’, alignItems: ‘center’, gap: 6, flexWrap: ‘wrap’ }}>
<span style={{ color: ‘#111827’, fontWeight: 700, fontSize: 13 }}>{item.name}</span>
<span style={{ color: cat.color, fontSize: 10, fontWeight: 600 }}>{cat.label}</span>
{ec && <span style={{ background: ec, color: ‘#fff’, borderRadius: 4, padding: ‘1px 5px’, fontSize: 9, fontWeight: 800 }}>{d < 0 ? ‘만료’ : d === 0 ? ‘오늘’ : `D-${d}`}</span>}
</div>
<div style={{ color: ‘#6b7280’, fontSize: 11, marginTop: 2 }}>{item.quantity && `${item.quantity}${item.unit}`}{item.expiry && ` · ${item.expiry}`}</div>
</div>
<div style={{ display: ‘flex’, gap: 2, flexShrink: 0 }}>
<button onClick={() => { setEditing(idx); setAdding(false) }} style={iconBtn}>✏️</button>
<button onClick={() => removeItem(idx)} style={iconBtn}>🗑️</button>
</div>
</div>
)
})}
</div>
)}
</div>
<div style={{ padding: ‘12px 16px’, borderTop: ‘1px solid #e5e7eb’, display: ‘flex’, gap: 8, flexShrink: 0, background: ‘#f9fafb’ }}>
<button onClick={onClose} style={{ …btn, flex: 1 }}>취소</button>
<button onClick={handleSave} style={{ …btn, flex: 2, border: ‘none’, background: ‘linear-gradient(135deg,#3b82f6,#6366f1)’, color: ‘#fff’ }}>저장</button>
</div>
</div>
</div>
)
}

function RecipeModal({ allItems, onClose }) {
const [text, setText] = useState(’’)
const [loading, setLoading] = useState(true)
const fetchRecipe = useCallback(async () => {
setLoading(true); setText(’’)
const list = allItems.map(i => `${i.name}(${i.quantity || ''}${i.unit || ''})`).join(’, ’)
try {
const res = await fetch(‘https://api.anthropic.com/v1/messages’, {
method: ‘POST’, headers: { ‘Content-Type’: ‘application/json’ },
body: JSON.stringify({ model: ‘claude-sonnet-4-20250514’, max_tokens: 1000, messages: [{ role: ‘user’, content: `냉장고에 이런 재료가 있어요: ${list}\n이 재료들로 만들 수 있는 맛있는 요리 2~3가지를 추천해주세요. 요리명, 필요 재료, 간단한 조리법을 알려주세요. 한국어로요.` }] }),
})
const data = await res.json()
setText(data.content?.find(b => b.type === ‘text’)?.text || ‘레시피를 불러올 수 없어요.’)
} catch { setText(‘오류가 발생했어요.’) }
setLoading(false)
}, [allItems])
useEffect(() => { fetchRecipe() }, [fetchRecipe])
return (
<div style={{ position: ‘fixed’, inset: 0, background: ‘rgba(0,0,0,0.5)’, display: ‘flex’, alignItems: ‘center’, justifyContent: ‘center’, zIndex: 300, backdropFilter: ‘blur(4px)’ }}>
<div style={{ background: ‘#fff’, borderRadius: 22, padding: 28, width: ‘min(480px,95vw)’, maxHeight: ‘80vh’, border: ‘1px solid #e5e7eb’, boxShadow: ‘0 20px 60px rgba(0,0,0,0.15)’, display: ‘flex’, flexDirection: ‘column’ }}>
<div style={{ display: ‘flex’, justifyContent: ‘space-between’, alignItems: ‘center’, marginBottom: 16 }}>
<h3 style={{ margin: 0, color: ‘#111827’, fontSize: 17 }}>🍳 AI 레시피 추천</h3>
<button onClick={fetchRecipe} style={{ …btn, padding: ‘5px 12px’, fontSize: 11 }}>🔄 다시</button>
</div>
<div style={{ flex: 1, overflowY: ‘auto’, color: ‘#374151’, fontSize: 13, lineHeight: 1.9 }}>
{loading ? <div style={{ textAlign: ‘center’, padding: ‘50px 0’, color: ‘#9ca3af’ }}><div style={{ fontSize: 36, marginBottom: 12 }}>🤔</div>레시피 생각 중…</div>
: <pre style={{ whiteSpace: ‘pre-wrap’, margin: 0, fontFamily: ‘inherit’ }}>{text}</pre>}
</div>
<button onClick={onClose} style={{ …btn, marginTop: 16, border: ‘none’, background: ‘linear-gradient(135deg,#3b82f6,#6366f1)’, color: ‘#fff’ }}>닫기</button>
</div>
</div>
)
}

function SyncBadge({ status }) {
const map = {
loading: { color: ‘#3b82f6’, label: ‘불러오는 중…’ },
saving:  { color: ‘#f59e0b’, label: ‘저장 중…’ },
synced:  { color: ‘#22c55e’, label: ‘실시간 동기화 중’ },
error:   { color: ‘#ef4444’, label: ‘오프라인 모드’ },
}
const cfg = map[status] || map.synced
return (
<div style={{ display: ‘flex’, alignItems: ‘center’, gap: 5 }}>
<div style={{ width: 7, height: 7, borderRadius: ‘50%’, background: cfg.color, boxShadow: `0 0 5px ${cfg.color}`, animation: status !== ‘synced’ ? ‘pulse 1s infinite’ : ‘none’ }} />
<span style={{ color: cfg.color, fontSize: 11 }}>{cfg.label}</span>
<style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
</div>
)
}

export default function App() {
const [sections,   setSections]   = useState(INITIAL_SECTIONS)
const [syncStatus, setSyncStatus] = useState(‘loading’)
const [slotModal,  setSlotModal]  = useState(null)
const [recipe,     setRecipe]     = useState(false)
const isSaving = useRef(false)

useEffect(() => {
async function load() {
if (!supabase) { setSyncStatus(‘error’); return }
setSyncStatus(‘loading’)
const { data, error } = await supabase.from(‘fridges’).select(‘sections’).eq(‘id’, FRIDGE_ID).single()
if (error && error.code !== ‘PGRST116’) { console.error(error); setSyncStatus(‘error’); return }
if (data) setSections(migrateSections(data.sections))
setSyncStatus(‘synced’)
}
load()
}, [])

useEffect(() => {
if (!supabase) return
const channel = supabase.channel(‘fridge-realtime’)
.on(‘postgres_changes’, { event: ‘*’, schema: ‘public’, table: ‘fridges’, filter: `id=eq.${FRIDGE_ID}` },
(payload) => { if (isSaving.current) return; if (payload.new?.sections) setSections(migrateSections(payload.new.sections)) })
.subscribe()
return () => { supabase.removeChannel(channel) }
}, [])

const persist = useCallback(async (next) => {
if (!supabase) return
isSaving.current = true; setSyncStatus(‘saving’)
const { error } = await supabase.from(‘fridges’).upsert({ id: FRIDGE_ID, sections: next, updated_at: new Date().toISOString() })
if (error) { console.error(error); setSyncStatus(‘error’) } else setSyncStatus(‘synced’)
isSaving.current = false
}, [])

const updateSlot = useCallback((sectionId, slotIdx, items) => {
setSections(prev => {
const next = { …prev, [sectionId]: { …prev[sectionId], slots: prev[sectionId].slots.map((s, i) => i === slotIdx ? { items } : s) } }
persist(next)
return next
})
}, [persist])

const allItems = Object.values(sections).flatMap(s => s.slots.flatMap(sl => sl.items || []))
const expiringSoon = allItems.filter(i => { const d = daysUntil(i.expiry); return d !== null && d >= 0 && d <= 3 }).length

const renderSection = (sectionId, isFreezer) => (
<div style={{ display: ‘flex’, flexDirection: ‘column’, gap: 5, flex: 1 }}>
{sections[sectionId].slots.map((slot, idx) => (
<SlotPanel key={idx} slot={slot} sectionId={sectionId} slotIdx={idx} isFreezer={isFreezer} onOpenSlot={setSlotModal} />
))}
</div>
)

return (
<div style={{
minHeight: ‘100vh’,
background: ‘linear-gradient(160deg, #fef9f0 0%, #f0f7ff 100%)’,
display: ‘flex’, flexDirection: ‘column’, alignItems: ‘center’,
justifyContent: ‘flex-start’, padding: ‘28px 16px 48px’,
fontFamily: “‘Noto Sans KR’, sans-serif”,
}}>
<div style={{ textAlign: ‘center’, marginBottom: 20 }}>
<h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: ‘#1f2937’ }}>
🧊 냉장고 식재료 관리
</h1>
<div style={{ marginTop: 6, display: ‘flex’, alignItems: ‘center’, justifyContent: ‘center’, gap: 12, flexWrap: ‘wrap’ }}>
<span style={{ color: ‘#6b7280’, fontSize: 12 }}>
총 {allItems.length}개 보관 중
{expiringSoon > 0 && <span style={{ color: ‘#ef4444’, marginLeft: 6 }}>⚠️ {expiringSoon}개 임박</span>}
</span>
<SyncBadge status={syncStatus} />
</div>
</div>

```
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
    {allItems.length > 0 && (
      <button onClick={() => setRecipe(true)} style={{ ...btn, background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', color: '#16a34a', border: '1px solid #86efac', padding: '9px 20px' }}>
        🍳 AI 레시피
      </button>
    )}
    <button style={{ ...btn, color: '#9ca3af', padding: '9px 20px', fontSize: 11 }}
      onClick={() => { if (window.confirm('모든 데이터를 초기화할까요?')) { setSections(INITIAL_SECTIONS); persist(INITIAL_SECTIONS) } }}>
      초기화
    </button>
  </div>
  <p style={{ color: '#9ca3af', fontSize: 11, marginTop: 12, textAlign: 'center' }}>칸을 클릭해 식재료를 추가 / 수정 / 삭제하세요</p>

  {slotModal && <SlotModal sectionId={slotModal.sectionId} slotIdx={slotModal.slotIdx} slot={sections[slotModal.sectionId].slots[slotModal.slotIdx]} onClose={() => setSlotModal(null)} onUpdate={updateSlot} />}
  {recipe && <RecipeModal allItems={allItems} onClose={() => setRecipe(false)} />}
</div>
```

)
}