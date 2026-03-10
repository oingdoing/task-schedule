-- heartbeat 기반 참여자 관리: last_seen_at 추가, 30초 미갱신 시 inactive
alter table public.chat_participants
  add column if not exists last_seen_at timestamptz not null default now();

-- 활성 참여자 목록 조회: 인증 사용자는 last_seen_at 기준으로 누가 활성인지 조회 가능
drop policy if exists "chat_participants_select_authenticated" on public.chat_participants;
create policy "chat_participants_select_authenticated"
  on public.chat_participants for select
  to authenticated
  using (true);

-- 참여자 목록 실시간 반영: postgres_changes 구독용 (이미 추가된 경우 에러 무시 가능)
alter publication supabase_realtime add table public.chat_participants;
