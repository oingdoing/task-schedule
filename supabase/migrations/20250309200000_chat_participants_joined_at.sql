-- 입장 시각 관리: joined_at 이후 메시지만 해당 사용자에게 노출
create table if not exists public.chat_participants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  joined_at timestamptz not null default now()
);

alter table public.chat_participants enable row level security;

-- 본인 행만 조회 (messages RLS 서브쿼리에서 사용)
create policy "chat_participants_select_own"
  on public.chat_participants for select
  to authenticated
  using (auth.uid() = user_id);

-- 입장 시 본인 행 삽입
create policy "chat_participants_insert_own"
  on public.chat_participants for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 재입장 시 joined_at 갱신
create policy "chat_participants_update_own"
  on public.chat_participants for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- messages SELECT: joined_at 이후 메시지만 조회 가능
drop policy if exists "messages_select_authenticated" on public.messages;

create policy "messages_select_after_joined"
  on public.messages for select
  to authenticated
  using (
    created_at >= (
      select joined_at from public.chat_participants
      where user_id = auth.uid()
    )
  );
