import { useState } from 'react';

const ENTRY_STORAGE_KEY = 'duty-schedule-entry-v1';
const ADMIN_FLAG_KEY = 'duty-schedule-admin-v1';

export function getEntryState(): { passed: boolean; isAdmin: boolean } {
  if (typeof window === 'undefined') {
    return { passed: false, isAdmin: false };
  }
  const raw = sessionStorage.getItem(ENTRY_STORAGE_KEY);
  const admin = sessionStorage.getItem(ADMIN_FLAG_KEY) === '1';
  return { passed: raw === '1', isAdmin: raw === '1' && admin };
}

export function setEntryState(passed: boolean, isAdmin: boolean): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(ENTRY_STORAGE_KEY, passed ? '1' : '0');
  sessionStorage.setItem(ADMIN_FLAG_KEY, isAdmin ? '1' : '0');
}

interface EntryGateProps {
  documentCode: string;
  onPass: (isAdmin: boolean) => void;
  onOpenAdminModal: () => void;
}

export default function EntryGate({
  documentCode,
  onPass,
  onOpenAdminModal,
}: EntryGateProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() !== documentCode) {
      setError('문서 코드가 일치하지 않습니다.');
      return;
    }
    setError('');
    setInput('');
    setEntryState(true, false);
    onPass(false);
  };

  return (
    <div className="entry-gate">
      <div className="entry-gate-card card">
        <h2>문서 코드 입력</h2>
        <p>정확한 문서 코드를 입력해야 입장할 수 있습니다.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError('');
            }}
            placeholder="문서 코드"
            autoFocus
          />
          {error && <p className="text-error">{error}</p>}
          <button type="submit">입장</button>
        </form>
        <button
          type="button"
          className="entry-gate-admin-link"
          onClick={onOpenAdminModal}
        >
          관리자로 입장하기
        </button>
      </div>
    </div>
  );
}
