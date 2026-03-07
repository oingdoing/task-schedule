import { useState } from 'react';

interface AdminCodeModalProps {
  isOpen: boolean;
  onCodeSubmit: (code: string) => Promise<void>;
  onClose: () => void;
}

export default function AdminCodeModal({
  isOpen,
  onCodeSubmit,
  onClose,
}: AdminCodeModalProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = input.trim();
    if (!code) return;
    setError('');
    setSubmitting(true);
    try {
      await onCodeSubmit(code);
      setInput('');
      setError('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '관리자 코드가 일치하지 않습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setInput('');
    setError('');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={handleClose} role="presentation">
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>관리자 코드 입력</h2>
          <button type="button" onClick={handleClose}>
            닫기
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p>관리자 코드를 입력해 주세요.</p>
            <input
              type="password"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError('');
              }}
              placeholder="관리자 코드"
              autoFocus
              disabled={submitting}
            />
            {error && <p className="text-error">{error}</p>}
          </div>
          <footer className="modal-footer">
            <button type="button" onClick={handleClose} className="secondary">
              취소
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? '확인 중...' : '확인'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
