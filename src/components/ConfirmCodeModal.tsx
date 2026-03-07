import { useState } from 'react';

interface ConfirmCodeModalProps {
  isOpen: boolean;
  expectedCode: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmCodeModal({
  isOpen,
  expectedCode,
  onConfirm,
  onClose,
}: ConfirmCodeModalProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() !== expectedCode) {
      setError('확인 코드가 일치하지 않습니다.');
      return;
    }
    setError('');
    setInput('');
    onConfirm();
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
          <h2>확인 코드 입력</h2>
          <button type="button" onClick={handleClose}>
            닫기
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p>확인 코드를 입력해 주세요.</p>
            <input
              type="password"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError('');
              }}
              placeholder="확인 코드"
              autoFocus
            />
            {error && <p className="text-error">{error}</p>}
          </div>
          <footer className="modal-footer">
            <button type="button" onClick={handleClose} className="secondary">
              취소
            </button>
            <button type="submit">확인</button>
          </footer>
        </form>
      </div>
    </div>
  );
}
