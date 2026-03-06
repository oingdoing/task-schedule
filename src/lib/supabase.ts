import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (typeof supabaseUrl !== 'string' || !supabaseUrl.trim()) {
  throw new Error(
    'VITE_SUPABASE_URL가 설정되지 않았습니다. .env 파일에 VITE_SUPABASE_URL를 추가해 주세요.',
  );
}
if (typeof supabaseKey !== 'string' || !supabaseKey.trim()) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY 또는 VITE_SUPABASE_PUBLISHABLE_KEY가 설정되지 않았습니다. .env 파일을 확인해 주세요.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/** 익명 세션 보장. 세션이 없으면 signInAnonymously 호출 */
export async function ensureAnonymousSession(): Promise<void> {
  if (typeof window === 'undefined') return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    await supabase.auth.signInAnonymously();
  }
}


console.log('SUPABASE URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('SUPABASE KEY PREFIX:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.slice(0, 20));
console.log('SUPABASE ANON PREFIX:', import.meta.env.VITE_SUPABASE_ANON_KEY?.slice(0, 20));