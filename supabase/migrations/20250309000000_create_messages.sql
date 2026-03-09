-- 채팅 메시지 테이블
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null
);

-- RLS 활성화
alter table public.messages enable row level security;

-- 인증된 사용자(익명 포함)만 조회 가능
create policy "messages_select_authenticated"
  on public.messages for select
  to authenticated
  using (true);

-- 인증된 사용자(익명 포함)만 삽입 가능
create policy "messages_insert_authenticated"
  on public.messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

-- Realtime 구독 활성화
-- 실패 시 Supabase 대시보드: Database → Replication → supabase_realtime → public.messages 추가
alter publication supabase_realtime add table public.messages;
