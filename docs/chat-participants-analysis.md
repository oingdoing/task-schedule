# 참여자 인식 문제 원인 분석

## 1. 현재 참여자 판정 로직과 데이터 흐름

### 1) Active 기준 (단일 기준)
- **사용 중인 기준:** `last_seen_at` 하나만 사용함. `is_active` 컬럼은 없음.
- **Active 정의:** `last_seen_at >= (현재 시각 - 30초)` 인 행만 조회해 참여자 목록으로 사용.
- **충돌:** `is_active`를 쓰지 않으므로 기준 충돌 없음.

### 2) Heartbeat / 만료 시간
- **Heartbeat:** 10초마다 `chat_participants.last_seen_at`을 현재 시각으로 UPDATE.
- **만료:** 30초 동안 갱신이 없으면 inactive (목록에서 제외).
- **관계:** 10초 주기면 최대 10초 지연까지는 active 유지 가능. 30초 > 10초이므로 논리적으로 문제 없음.
- **가능 이슈:** 참여자 목록은 **10초 폴링**이라, 다른 사용자 입/퇴장이 최대 10초 뒤에야 반영됨 → “실시간에 가깝지 않다”고 느낄 수 있음.

### 3) 새로고침 / 재입장 시 중복 행
- **스키마:** `chat_participants.user_id`가 PRIMARY KEY → 사용자당 1행만 존재.
- **재입장 시:**  
  - 기존 행 있음 → `update({ last_seen_at: now })` 만 수행 (같은 행 갱신).  
  - 없음 → `upsert(..., { onConflict: 'user_id' })` 로 1행만 유지.
- **결론:** 새로고침/재입장으로 인한 중복 행은 생성되지 않음.

### 4) X 버튼 vs beforeunload / pagehide
- **현재:** `beforeunload` / `pagehide` 리스너는 제거된 상태. 퇴장 메시지 및 inactive 처리는 **X 버튼(handleClose)** 에서만 수행.
- **결론:** 두 경로가 동시에 동작하지 않아 충돌 없음.

### 5) 참여자 목록 UI 반영
- **현재:** `fetchActiveParticipants()`를 **10초마다 setInterval** 로만 호출.  
  `chat_participants` 테이블에 대한 **realtime 구독(INSERT/UPDATE)** 은 없음.
- **결과:** DB가 바뀌어도 최대 10초까지는 UI에 반영되지 않음. “참여 중인 사용자를 정확히 인지하지 못한다”는 느낌의 주요 원인일 가능성이 큼.

---

## 2. 문제 원인 정리

| 항목 | 상태 | 비고 |
|------|------|------|
| Active 기준 | 단일(`last_seen_at`) | 충돌 없음 |
| Heartbeat/만료 | 10초/30초로 적절 | - |
| 행 중복 | 없음 (PK + upsert) | - |
| X vs unload | 충돌 없음 | - |
| **참여자 목록 갱신** | **10초 폴링만 사용** | **갱신 지연이 가장 유력한 원인** |

**추가 가능 원인:**  
- 마이그레이션 `20250310100000_chat_participants_last_seen.sql` 미적용 시,  
  `chat_participants_select_authenticated` 정책이 없어 **본인 행만** 보일 수 있음.  
  → 참여자 목록에 다른 사용자가 안 보이면, Supabase SQL Editor에서 해당 마이그레이션 적용 여부를 먼저 확인하는 것이 좋음.

---

## 3. 해결 방향 (최소 수정)

1. **참여자 조회 기준:**  
   계속 **`last_seen_at` 하나만** 사용 (유지). `is_active` 추가하지 않음.

2. **참여자 목록을 더 빠르게 반영:**  
   - `chat_participants` 테이블에 대한 **postgres_changes 구독**(INSERT/UPDATE) 추가.  
   - 해당 테이블에 변경이 있을 때마다 `fetchActiveParticipants()` 한 번 호출해 목록 갱신.  
   - 필요 시 Supabase에서 `chat_participants`를 `supabase_realtime` publication에 포함.

3. **마이그레이션 적용 확인:**  
   - `chat_participants_select_authenticated` 정책이 있어야 모든 참여자가 보임.  
   - 적용 안 되어 있으면 SQL Editor에서 해당 마이그레이션 실행.

위와 같이 **기준은 그대로 두고**, **갱신 경로만 realtime 구독으로 보강**하는 것이 최소 수정입니다.
