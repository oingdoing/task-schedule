# 백엔드 연동 가이드

여러 사용자가 같은 일정 데이터를 공유하려면 백엔드와 데이터 저장소가 필요합니다.

---

## 추천 옵션 비교

| 옵션 | 장점 | 단점 | 난이도 |
|------|------|------|--------|
| **Supabase** | 무료 티어, PostgreSQL, 실시간 구독 | 외부 서비스 의존 | ★★☆ |
| **Firebase** | 빠른 설정, 실시간 동기화 | Google 의존, NoSQL | ★★☆ |
| **직접 구현** | 완전 제어, 커스텀 가능 | 서버 호스팅·관리 필요 | ★★★ |

---

## 1. Supabase로 구현하기 (추천)

### 1-1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 회원가입
2. New Project 생성
3. 프로젝트 설정에서 **Project URL**, **anon key** 확인

### 1-2. 테이블 생성

Supabase SQL Editor에서 실행:

```sql
-- 일정 데이터 저장 (한 문서 = 한 행)
CREATE TABLE schedule_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT UNIQUE NOT NULL DEFAULT 'default',
  data JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 편집 잠금 (동시 수정 방지)
CREATE TABLE edit_lock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  locked_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- RLS 정책 (공개 읽기, 인증된 사용자만 쓰기 등 필요에 맞게 조정)
ALTER TABLE schedule_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE edit_lock ENABLE ROW LEVEL SECURITY;
```

### 1-3. 프론트엔드 수정

**패키지 설치**
```bash
npm install @supabase/supabase-js
```

**환경 변수** (`.env`)
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

**Supabase 클라이언트** (`src/lib/supabase.ts`)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

**데이터 로드/저장** 예시
```typescript
// 불러오기
const { data } = await supabase
  .from('schedule_data')
  .select('data, version')
  .eq('document_id', 'default')
  .single();

// 저장 (version으로 동시 수정 체크)
const { error } = await supabase
  .from('schedule_data')
  .upsert({
    document_id: 'default',
    data: scheduleData,
    version: data.version + 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'document_id' });
```

### 1-4. App.tsx에서 변경할 부분

- `loadData()`: `localStorage` 대신 Supabase `from('schedule_data').select()` 호출
- `useEffect` 저장: Supabase `upsert` 호출
- 실시간 구독(선택): `supabase.channel('schedule').on('postgres_changes', ...)` 로 다른 사용자 변경 감지

---

## 2. Firebase로 구현하기

### 2-1. Firebase 프로젝트

1. [Firebase Console](https://console.firebase.google.com)에서 프로젝트 생성
2. Firestore Database 활성화
3. 웹 앱 추가 후 config 복사

### 2-2. 설치 및 설정

```bash
npm install firebase
```

**`src/lib/firebase.ts`**
```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = { /* 프로젝트 config */ };

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

### 2-3. 데이터 구조

- 컬렉션: `schedules`
- 문서 ID: `default` (또는 문서 코드별로 분리)
- 필드: `data` (객체), `version` (번호), `updatedAt` (타임스탬프)

### 2-4. 읽기/쓰기

```typescript
import { doc, getDoc, setDoc } from 'firebase/firestore';

const ref = doc(db, 'schedules', 'default');
const snap = await getDoc(ref);
const data = snap.exists() ? snap.data().data : null;

await setDoc(ref, { data: newData, version: version + 1, updatedAt: serverTimestamp() });
```

---

## 3. 동시 수정 방지 방식

### 방식 A: 낙관적 잠금 (Optimistic Locking)

- 저장 시 `version`을 함께 전달
- 서버에서 현재 `version`과 비교 → 다르면 "다른 사용자가 수정했습니다" 오류
- 클라이언트는 최신 데이터 다시 불러와서 표시

### 방식 B: 편집 잠금 (Edit Lock)

- 편집 시작 시: "잠금 요청" API 호출 (예: 5분 유효)
- 다른 사용자: "다른 사용자가 수정 중입니다" 표시
- 편집 종료/저장 시: 잠금 해제 API 호출

### 방식 C: 실시간 동기화

- Supabase Realtime / Firebase onSnapshot 사용
- 다른 사용자 변경 시 자동으로 화면 갱신
- 충돌은 "마지막 저장 승리" 또는 사용자에게 선택하도록 처리

---

## 4. 배포

- **프론트엔드**: Vercel, Netlify 등에 배포 (현재 Vite 프로젝트 그대로)
- **환경 변수**: 배포 플랫폼에서 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 설정
- **백엔드**: Supabase / Firebase는 클라우드 제공, 별도 서버 불필요

---

## 5. 구현 순서 제안

1. Supabase 프로젝트 생성 및 테이블 생성
2. `src/lib/supabase.ts` 추가
3. `loadData()`를 Supabase 조회로 변경
4. `useEffect` 저장 로직을 Supabase upsert로 변경
5. 초기 데이터가 없을 때 `baseData()`로 insert
6. (선택) 동시 수정 방지를 위해 version 체크 추가
7. (선택) 실시간 구독으로 자동 갱신

이 순서대로 적용하면, 여러 사용자가 같은 일정을 공유할 수 있습니다.
