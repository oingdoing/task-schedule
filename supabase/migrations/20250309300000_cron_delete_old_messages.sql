-- =============================================================================
-- 7일 지난 채팅 메시지 자동 삭제 (pg_cron)
-- Supabase SQL Editor에서 위에서부터 순서대로 전체 실행.
--
-- 사전 요건: Dashboard > Integrations > Cron 에서 pg_cron 확장을 활성화한 뒤 실행.
-- 실행 시각: 서버(UTC) 기준. 한국 시간 새벽 3시 = UTC 18:00(전일) → '0 18 * * *' 등으로 조정 가능.
-- =============================================================================

-- 1) pg_cron 확장 활성화 (이미 활성화된 경우 무시)
create extension if not exists pg_cron with schema pg_catalog;

-- 2) 삭제 함수: created_at 기준 7일 초과 메시지 삭제
--    SECURITY DEFINER: cron 실행 시 RLS를 우회하고 삭제 수행
create or replace function public.delete_old_chat_messages()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count bigint;
begin
  delete from public.messages
  where created_at < now() - interval '7 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

comment on function public.delete_old_chat_messages() is
  'created_at이 7일 지난 public.messages 행을 삭제. pg_cron에서 일 1회 호출용.';

-- 3) 스케줄 등록은 SQL이 아닌 Dashboard에서만 가능합니다.
--    Supabase Dashboard > Integrations > Cron > Create a new cron job:
--    - Name: delete-old-chat-messages
--    - Schedule: 0 3 * * * (매일 03:00 UTC. 한국 새벽 3시면 0 18 * * *)
--    - Command: "Run a database function" → delete_old_chat_messages 선택
--
--    (SQL Editor에서 cron.schedule / extensions.cron.schedule 호출은
--     cross-database 또는 schema 오류로 실패하므로 사용하지 않습니다.)
