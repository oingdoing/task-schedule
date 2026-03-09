-- messages 테이블 확장: 공용 채팅용 컬럼 추가
alter table public.messages
  add column if not exists message_type text not null default 'user',
  add column if not exists sender_nickname text,
  add column if not exists image_url text;

alter table public.messages alter column body drop not null;
alter table public.messages alter column sender_id drop not null;

-- 기존 insert 정책 제거 후 재정의
drop policy if exists "messages_insert_authenticated" on public.messages;

-- 사용자 메시지: 본인 sender_id로만 삽입
create policy "messages_insert_user"
  on public.messages for insert to authenticated
  with check (
    message_type = 'user' and auth.uid() = sender_id
  );

-- 시스템 메시지(입장/퇴장): 인증된 사용자 누구나 삽입 가능
create policy "messages_insert_system"
  on public.messages for insert to authenticated
  with check (
    message_type = 'system'
  );

-- Storage: 채팅 이미지 버킷 (공개 읽기, 인증 사용자 업로드)
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

-- 버킷 정책: 인증된 사용자 읽기
create policy "chat_images_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'chat-images');

-- 버킷 정책: 인증된 사용자 업로드 (본인 경로 권장: user_id/...)
create policy "chat_images_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-images');
