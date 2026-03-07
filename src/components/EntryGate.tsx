import { useState } from 'react';

interface EntryGateProps {
  onCodeSubmit: (code: string) => Promise<void>;
  error: string | null;
  onOpenAdminModal: () => void;
}

export default function EntryGate({
  onCodeSubmit,
  error,
  onOpenAdminModal,
}: EntryGateProps) {
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = input.trim();
    if (!code) return;
    setSubmitting(true);
    try {
      await onCodeSubmit(code);
      setInput('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="entry-gate">
      <div className="entry-gate-card card">
        <h2>문서 코드 입력</h2>
        <p>정확한 문서 코드를 입력해야 입장할 수 있습니다.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="문서 코드"
            autoFocus
            disabled={submitting}
          />
          {error && <p className="text-error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? '확인 중...' : '입장'}
          </button>
        </form>
        <button
          type="button"
          className="entry-gate-admin-link"
          onClick={onOpenAdminModal}
          disabled={submitting}
        >
          관리자로 입장하기
        </button>
      </div>
    </div>
  );
}
