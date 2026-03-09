# 채팅 기능 상세 설계

## 1. 프로젝트 구조 분석

### 1.1 현재 구조 요약

- **진입점**: `index.html` → `main.tsx` → `App.tsx` 단일 트리. **라우터 없음.**
- **접근 제어**: `App.tsx` 내부에서 `accessState`로 진입 코드 통과 여부에 따라 `EntryGate` vs 메인(스케줄) 뷰 분기. 메인 뷰에서만 "채팅하기" 버튼 노출.
- **채팅 현황**: "채팅하기" 클릭 시 `ChatModal`(레이어 팝업)으로 열림. `ChatModal.tsx`는 `messages` 테이블 기준 텍스트만 송수신, 닉네임/이미지/입퇴장 시스템 메시지 없음.

### 1.2 디렉터리 구조

```
src/
  App.tsx              # 단일 앱 루트, accessState 분기
  main.tsx              # React 마운트만 수행
  lib/supabase.ts       # Supabase 클라이언트, ensureAnonymousSession
  components/           # Header, Modals, ChatModal 등
  hooks/, utils/, types/, data/
index.html              # 유일한 HTML 진입점
vite.config.ts         # 단일 엔트리 기본 설정
```

### 1.3 결론

- 메인 앱에는 **라우터를 도입하지 않고**, 기존 `App.tsx` / `main.tsx` 로직은 유지한다.
- 채팅 전용 **별도 HTML 진입점**을 두어, **접근 제한 없이** 채팅만 렌더링하는 방식이 요구사항과 부합한다.

---

## 2. 채팅 페이지 경로 및 진입 방식

### 2.1 채팅 전용 페이지 경로

| 환경       | URL (기준)   | 비고 |
|------------|--------------|------|
| 개발 (Vite) | `http://localhost:5173/chat.html` | 동일 오리진 |
| 프로덕션   | `https://도메인/chat.html`          | 배포 경로에 따라 `/폴더/chat.html` 가능 |

- **경로**: `chat.html` (프로젝트 루트에 `index.html`과 나란히 두는 방식 권장).
- 같은 오리진이므로 Supabase 세션(쿠키/스토리지) 공유되어, 별도 로그인 없이 채팅 가능.

### 2.2 새 창 열기

- 메인 앱의 "채팅하기" 버튼 동작을 **레이어 팝업** 대신 **새 창**으로 변경한다.

```ts
// 예시 (App.tsx 내 버튼)
window.open(
  'chat.html',  // 상대 경로로 배포 경로 자동 반영
  '_blank',
  'width=430,height=800,scrollbars=yes,resizable=yes'
);
```

- `window.open` 세 번째 인자로 창 크기(430×800) 지정.
- 접근 제한 없이 열므로, 메인에서 `accessState` 통과 여부와 무관하게 같은 `chat.html`을 열어도 됨. (요구사항상 채팅 페이지는 접근 제한 없음.)

### 2.3 빌드 설정

- Vite **멀티 페이지**로 `chat.html`을 두 번째 엔트리로 추가.
- `vite.config.ts`에서 `build.rollupOptions.input`에 `index.html`, `chat.html` 포함.
- 결과: `dist/index.html`(기존 앱), `dist/chat.html`(채팅 전용) 둘 다 생성.

### 2.4 채팅 구조 및 퇴장 처리

- **공용 채팅**: 별도 room 구분 없이 **전체 사용자가 하나의 공용 채팅**을 사용하는 구조로 구현한다. 단일 `messages` 테이블에 모든 메시지를 저장한다.
- **퇴장 시스템 메시지**: `beforeunload` / `pagehide` 기반으로 퇴장 메시지 전송을 시도한다. 브라우저 종료·탭 강제 종료·네트워크 상황 등으로 **누락될 수 있으며 이를 허용**한다.
- **X 버튼(나가기)**:
  1. 우선 **퇴장 시스템 메시지를 전송 시도**한 뒤 `window.close()`를 호출한다.
  2. 브라우저 정책상 창이 닫히지 않는 경우(예: 스크립트로 연 창이 아닐 때)를 대비해, **채팅 UI에서는 최소한 퇴장 처리(퇴장 시스템 메시지 전송)만 수행**되도록 한다. 즉, X 클릭 시 항상 퇴장 메시지 INSERT를 시도하고, 그 다음 창 닫기를 시도한다.

### 2.5 입장 후 참여 현황 안내 (일회성)

- 사용자가 **최초 입장해 닉네임을 설정한 직후**, 해당 사용자 화면에만 **일회성**으로 다음을 표시한다.
  - **현재 참여 인원 수**
  - **현재 참여 중인 사용자 닉네임 목록**
- 이 안내는 **채팅 히스토리(messages)에 저장하지 않는다**. 입장한 사용자 화면에만 잠시 보였다가 닫거나 자동으로 사라지는 **시스템 안내 UI**로 구현한다.

### 2.6 활성 참여자 관리 및 active 판단

현재 참여 중인 사용자를 알려면 "누가 지금 채팅창에 있는가"를 추적할 수 있는 구조가 필요하다. 두 가지 방식을 제안한다.

| 방식 | 설명 | active 판단 | 비고 |
|------|------|--------------|------|
| **A. chat_participants 테이블** | DB 테이블에 `user_id`, `nickname`, `last_seen_at` 저장. | **heartbeat**: 주기(예: 30초)마다 `last_seen_at = now()` 갱신. **active** = `last_seen_at`이 최근 N초(예: 90초) 이내인 행. 브라우저 종료/네트워크 끊김 시 heartbeat가 멈추므로 N초 후 자동으로 목록에서 제외. | 퇴장 시 DELETE로 제거하면 즉시 반영되나, 비정상 종료 시에는 N초 지연으로 제거됨. |
| **B. Supabase Realtime Presence** | DB 테이블 없음. Realtime 채널의 Presence 기능으로 "지금 이 채널에 붙어 있는 연결"과 각 연결의 state(닉네임 등)를 관리. | **active** = 현재 해당 채널에 연결된 클라이언트. 연결이 끊기면(탭 닫기, 브라우저 종료, 네트워크 끊김) 서버가 자동으로 presence에서 제거. 지연은 보통 수 초 이내. | 별도 테이블·heartbeat 불필요. 구현 단순. |

- **권장**: **B. Realtime Presence**로 구현. 별도 마이그레이션 없이, 입장 시 같은 채널에 presence로 `track({ nickname, user_id })` 하고, `presence` 이벤트 `sync` 시 `presenceState()`로 현재 접속자 목록을 구해 일회성 안내에 사용한다.
- **active 판단 한계**: 두 방식 모두 브라우저 강제 종료·네트워크 단절 시에는 즉시 감지되지 않는다. A는 N초 후, B는 Realtime 서버의 연결 끊김 감지 후(보통 수 초) 목록에서 사라진다.

### 2.7 입장 시점 이전 히스토리 미노출

- **정책**: 새로 입장한 사용자는 **자신의 입장 시점(joined_at) 이전** 채팅 히스토리를 볼 수 없다. 채팅창에는 **joined_at 이후에 생성된 메시지만** 표시된다.
- **적용 범위**: 텍스트 메시지, 이미지 메시지, 시스템 메시지 모두 동일. 기존 메시지는 DB에서 삭제하지 않고, **새 참여자에게만** RLS·클라이언트 필터로 보이지 않게 한다.
- **구조**: 사용자별 입장 시각을 `chat_participants.joined_at`으로 관리. messages SELECT RLS에서 `created_at >= (SELECT joined_at FROM chat_participants WHERE user_id = auth.uid())` 조건 적용. Realtime INSERT 수신 시에도 클라이언트에서 `created_at >= joined_at`인 경우만 목록에 반영.

---

## 3. Supabase 테이블 및 Storage 제안

### 3.1 메시지 테이블 확장

**현재** `public.messages`:

- `id`, `created_at`, `sender_id`, `body`

**추가/변경 제안**:

| 컬럼             | 타입         | nullable | 설명 |
|------------------|-------------|----------|------|
| `message_type`   | `text`      | NO       | `'user'` \| `'system'` |
| `sender_nickname`| `text`      | YES      | 사용자 메시지일 때 표시 이름 (입장 시 입력한 닉네임) |
| `image_url`      | `text`      | YES      | 이미지 메시지일 때 Storage 공개 URL |
| `body`           | `text`      | YES      | 시스템 메시지는 "OOO님이 입장했습니다." 등, 사용자 메시지는 본문. 이미지만 보낼 경우 빈 문자열 허용 |

- **시스템 메시지**: `message_type = 'system'`, `sender_id`는 `NULL` 허용하도록 스키마/RLS 조정. 또는 기존처럼 `sender_id` 필수라면 익명 시스템용 고정 UUID 하나 두고 사용 가능.
- **RLS**: 기존 정책 유지. `INSERT` 시 `message_type = 'system'`이면 `sender_id` 체크 완화(시스템은 서버/트리거에서 넣거나, 클라이언트에서 허용 정책 추가).

**마이그레이션 예시 방향**:

- `ALTER TABLE public.messages` 로 `message_type`, `sender_nickname`, `image_url` 추가.
- `body`는 `NULL` 허용으로 변경 (이미지 전용 메시지 대비).
- 시스템 메시지 삽입을 허용하는 RLS 정책 추가.

### 3.2 Storage 사용

- **버킷**: `chat-images` (또는 `public-chat-images`).
- **용도**: 채팅에서 업로드한 이미지 저장.
- **경로 예**: `{user_id}/{uuid}.{ext}` 또는 `{date}/{uuid}.{ext}`.
- **정책**:
  - `SELECT`: 인증된 사용자(또는 공개 읽기)로 해당 버킷 객체 조회 가능.
  - `INSERT`: 인증된 사용자 본인만 업로드 가능.
- 업로드 후 반환된 **public URL**을 `messages.image_url`에 저장하고, 클라이언트에서는 해당 URL로 `<img>` 표시.

### 3.3 chat_participants 테이블 (입장 시각·히스토리 제한)

**목적**: 사용자별 입장 시각(`joined_at`)을 저장해, **해당 사용자는 joined_at 이후에 생성된 메시지만 보이도록** 하기 위함.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `user_id` | uuid | auth.users(id). PK. |
| `nickname` | text | 표시용 닉네임. |
| `joined_at` | timestamptz | 이 사용자가 채팅에 입장한 시각. |

- **입장 시**: INSERT or UPSERT (`user_id` 기준). `joined_at = now()`로 설정. 재입장 시에도 `joined_at`을 갱신해, 그 시점 이후 메시지만 보이게 함.
- **messages SELECT RLS**: `created_at >= (SELECT joined_at FROM chat_participants WHERE user_id = auth.uid())` 인 행만 조회 가능. `chat_participants`에 행이 없으면 서브쿼리가 NULL이 되어 조회 0건.
- **Realtime**: INSERT 이벤트로 오는 새 행은 서버 시각 기준으로 항상 “방금” 생성된 것이므로, 클라이언트에서 해당 사용자의 `joined_at`과 비교해 `created_at >= joined_at`일 때만 목록에 반영하면 됨. (클라이언트는 입장 시점에 `joined_at`을 저장해 두고 이 값으로 필터링.)

### 3.4 7일 경과 메시지 자동 삭제 (pg_cron)

- **목적**: 운영 중 `public.messages` 데이터 증가 방지.
- **방식**: DB 레벨 처리. `delete_old_chat_messages()` 함수가 `created_at < now() - interval '7 days'` 조건으로 삭제. pg_cron으로 매일 1회(예: 새벽 3시 UTC) 실행.
- **구현**: `supabase/migrations/20250309300000_cron_delete_old_messages.sql` 참고. Supabase SQL Editor에서 실행 가능. messages 테이블 구조와 충돌 없음(기존 컬럼만 사용한 DELETE).

---

## 4. 변경/추가 파일 목록 및 변경 이유

### 4.1 새로 추가할 파일

| 파일 | 목적 |
|------|------|
| `chat.html` | 채팅 전용 HTML 진입점. `id="root"` + `src/chat.tsx` 로드. 접근 제한 없음. |
| `src/chat.tsx` | 채팅 앱 전용 엔트리. React 루트에 채팅 페이지만 마운트. |
| `src/pages/ChatPage.tsx` | 채팅 페이지 전체 UI: 닉네임 입력 → 메시지 목록 + 입력창(+ 버튼, 전송), X(나가기). |
| `src/chat.css` | 채팅 페이지 전용 스타일. 첨부 이미지 참고(내/상대 정렬, 시스템 메시지, 버블, + 버튼 등). 전역 스타일은 건드리지 않음. |
| `supabase/migrations/YYYYMMDD_chat_messages_extend_and_storage.sql` | messages 컬럼 추가, Storage 버킷 및 RLS, Realtime 유지. |

### 4.2 수정할 파일

| 파일 | 변경 내용 | 이유 |
|------|-----------|------|
| `vite.config.ts` | `build.rollupOptions.input: { main: 'index.html', chat: 'chat.html' }` 추가 | `chat.html`을 빌드/서빙 대상에 포함. |
| `src/App.tsx` | "채팅하기" 버튼을 `window.open('chat.html', '_blank', 'width=430,height=800,...')` 로 변경. `ChatModal` import/사용 및 `isChatOpen` state 제거 | 채팅을 새 창으로만 열고, 레이어 팝업 제거. |
| `src/styles.css` | `.chat-modal` 및 채팅 모달 전용 `.chat-*` 블록 제거 (`.chat-fab`은 유지) | 더 이상 사용하지 않는 모달 스타일 제거, 채팅 스타일은 `chat.css`로 이전. |

### 4.3 제거할 파일

| 파일 | 이유 |
|------|------|
| `src/components/ChatModal.tsx` | 채팅이 새 창 전용 페이지로 이전되므로 미사용. |

---

## 5. UI/기능 요구사항 매핑

### 5.1 UI (첨부 이미지 참고)

- **우측 상단 X 버튼**: 퇴장 시스템 메시지 전송 시도 후 `window.close()` 호출. 브라우저 정책으로 창이 닫히지 않으면 퇴장 처리(시스템 메시지 전송)만 수행.
- **내 메시지 우측 / 다른 사용자 좌측**: `.chat-message.is-mine` / `.chat-message.is-others`, flex 정렬로 우/좌 구분.
- **메시지 한 줄 구조**: 사용자 이름(닉네임) + 전송 시간(한 줄), 그 아래 메시지 내용(및 이미지).
- **입력창 왼쪽 + 버튼**: `input[type="file"] accept="image/*"`를 숨기고, + 버튼 클릭 시 파일 선택. 선택된 이미지 업로드 후 `image_url`로 메시지 INSERT.
- **디자인**: 연한 배경, 내 메시지 버블(노란 계열), 상대 버블(흰색), 시스템 메시지(회색 박스 가운데 정렬). `src/chat.css`에서만 정의하고, `:root` 등 기존 변수만 가져다 쓰면 프로젝트 스타일과 충돌 최소화.

### 5.2 기능

- **텍스트 메시지**: 기존과 동일하게 `body`에 텍스트, `message_type='user'`, `sender_nickname` 세션 닉네임.
- **이미지 메시지**: Storage 업로드 → URL 획득 → `messages`에 `image_url` + `body`(빈 문자열 또는 캡션) INSERT.
- **실시간 반영**: 기존처럼 `postgres_changes` INSERT 구독 유지. 확장된 컬럼 포함해 `select` 하도록 클라이언트 수정.
- **닉네임**: 채팅 창에서 최초 1회 입력 후 `sessionStorage`에 저장. 해당 창 세션 동안만 사용. DB에는 메시지 INSERT 시 `sender_nickname`으로 포함.
- **입장 시스템 메시지**: 닉네임 제출 시점에 `message_type='system'`, `body='{닉네임}님이 입장했습니다.'` INSERT.
- **퇴장 시스템 메시지**: `beforeunload` / `pagehide`에서 `message_type='system'`, `body='{닉네임}님이 퇴장했습니다.'` INSERT 시도. 네트워크/강제 종료 시 누락 가능성은 문서에 명시.

---

## 6. 구현 순서 제안

1. **Supabase**: 마이그레이션 적용 (messages 확장, Storage 버킷·정책). Realtime은 기존 publication 유지.
2. **진입점**: `chat.html` 추가, `src/chat.tsx` 작성, `vite.config.ts` 수정. `ChatPage.tsx`는 빈 껍데기로라도 마운트해 두어 430×800 창에서 채팅 페이지만 보이게.
3. **ChatPage UI**: 닉네임 입력 화면 → 저장 후 메인 채팅 화면 전환. 헤더(X), 메시지 목록(시스템/내/상대 구분), 입력 영역(+ 버튼, 텍스트, 전송).
4. **메시지 송수신**: 기존 Supabase `messages` 조회·INSERT·Realtime 구독을 확장 스키마에 맞게 수정. 닉네임·message_type·image_url 반영.
5. **이미지 업로드**: Storage 업로드 후 URL을 `image_url`로 INSERT. 클라이언트에서 이미지 메시지 렌더링.
6. **입장/퇴장**: 입장 시 시스템 메시지 INSERT. 퇴장 시 `beforeunload`/`pagehide`에서 시스템 메시지 INSERT 시도.
7. **메인 앱 정리**: App.tsx에서 채팅 버튼을 `window.open`으로 변경, ChatModal·isChatOpen 제거. styles.css에서 채팅 모달 스타일 제거. ChatModal.tsx 삭제.

---

## 7. 코드 수정안 요약 (파일별)

### 7.1 chat.html

- `index.html`과 동일한 구조. `title`만 "채팅" 등으로 변경. `script`는 `src="/src/chat.tsx"`.

### 7.2 src/chat.tsx

- `ReactDOM.createRoot(document.getElementById('root')!).render(<ChatPage />)`.
- `import './styles.css'` 후 `import './chat.css'`로 채팅 전용 스타일 적용. (또는 styles.css는 변수만 쓰고 chat.css에서 대부분 정의.)

### 7.3 src/pages/ChatPage.tsx

- **상태**: `nickname` (sessionStorage에서 복원 또는 null), `messages`, `input`, `imageFile`, `sendError`, `loading` 등.
- **닉네임 미설정 시**: 닉네임 입력 폼만 렌더. 제출 시 sessionStorage 저장 + 입장 시스템 메시지 INSERT + `nickname` state 설정.
- **닉네임 설정 후**: 헤더(제목 + X 버튼), 메시지 목록(`.chat-message`에 `.is-mine`/`.is-others`/`.is-system`), 하단 입력(+ 버튼, input, 전송). Realtime 구독 및 기존 메시지 `select`는 `message_type`, `sender_nickname`, `image_url` 포함.
- **X 클릭**: 퇴장 시스템 메시지 INSERT 시도 → `window.close()`. 창이 닫히지 않아도 퇴장 메시지는 전송 완료된 상태로 둠.

### 7.4 src/chat.css

- `.chat-page` 루트 하위로 스코프. 시스템 메시지(가운데, 회색 박스), 내 메시지(우측, 노란 계열), 상대 메시지(좌측, 흰색). 메시지별 이름·시간·본문·이미지. 입력 영역 + 버튼, 전송 버튼. 기존 `:root` 변수만 참조해 색/선 등 통일.

### 7.5 App.tsx

- "채팅하기" 버튼 `onClick`: `window.open('chat.html', '_blank', 'width=430,height=800,scrollbars=yes,resizable=yes')`.
- `ChatModal` import 제거, `isChatOpen` state 제거, `<ChatModal ... />` 제거.

### 7.6 vite.config.ts

- `build: { rollupOptions: { input: { main: 'index.html', chat: 'chat.html' } } }` 추가.

### 7.7 마이그레이션 SQL

- `ALTER TABLE public.messages ADD COLUMN message_type text NOT NULL DEFAULT 'user'`, `ADD COLUMN sender_nickname text`, `ADD COLUMN image_url text`, `ALTER COLUMN body DROP NOT NULL`(필요 시).
- 시스템 메시지 INSERT 허용 RLS (예: `message_type = 'system'`이면 `sender_id` null 허용 또는 별도 정책).
- Storage 버킷 생성 및 읽기/쓰기 RLS.

---

이 설계대로 적용하면 기존 스케줄/진입 흐름은 그대로 두고, 채팅만 새 창 전용 페이지로 분리·확장할 수 있습니다.
