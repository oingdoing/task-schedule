import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDateWithWeekday, getDutyLabel } from '../utils/rotation';
import type { SwapDutyType } from '../types/schedule';

interface SubstituteModalProps {
  isOpen: boolean;
  originalPerson: string;
  slotDate: string;
  dutyType: SwapDutyType;
  onSave: (substituteName: string) => void;
  onClose: () => void;
}

export default function SubstituteModal({
  isOpen,
  originalPerson,
  slotDate,
  dutyType,
  onSave,
  onClose,
}: SubstituteModalProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      window.alert('이름을 입력해 주세요.');
      return;
    }
    onSave(trimmed);
    onClose();
  }, [name, onSave, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleSave, onClose],
  );

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal card substitute-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>대신하기</h2>
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </header>
        <div className="modal-body">
          <p className="substitute-context">
            {formatDateWithWeekday(slotDate)} {getDutyLabel(dutyType)} - {originalPerson}
          </p>
          <label className="substitute-input-wrap">
            <span>대신할 사람 이름</span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="이름을 입력하세요"
            />
          </label>
        </div>
        <footer className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            취소
          </button>
          <button type="button" onClick={handleSave}>
            저장
          </button>
        </footer>
      </div>
    </div>
  );
}
