import { createClient } from '@supabase/supabase-js'

const rawUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const rawKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

// 설정이 없거나 형식이 잘못돼도 앱이 죽지 않도록 방어적으로 생성합니다.
function createSupabaseClient() {
  if (!rawUrl || !rawKey) {
    if (import.meta.env.DEV) console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 설정되지 않았습니다. 오프라인 모드로 동작합니다.')
    return null
  }
  let url
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      console.error('[supabase] VITE_SUPABASE_URL 은 http(s) 주소여야 합니다.')
      return null
    }
    url = parsed.toString().replace(/\/+$/, '')
  } catch {
    console.error('[supabase] VITE_SUPABASE_URL 형식이 올바르지 않습니다.')
    return null
  }
  try {
    // 인증 기능을 쓰지 않으므로 세션 저장(로컬 스토리지)을 끕니다.
    return createClient(url, rawKey, { auth: { persistSession: false, autoRefreshToken: false } })
  } catch (err) {
    console.error('[supabase] 클라이언트 생성 실패', err)
    return null
  }
}

export const supabase = createSupabaseClient()
export const supabaseConfigured = Boolean(supabase)
